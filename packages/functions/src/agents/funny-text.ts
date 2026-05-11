import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { buildFunnyTextPrompt, createLogger, emitMetric } from '@uweather/core';
import type { ConsensusForecast } from '@uweather/core';
import type { Context } from 'aws-lambda';
import { forecastService } from '../services/index.js';

const bedrock = new BedrockRuntimeClient({});
const log = createLogger({ function: 'agent-funny-text' });

const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const MAX_HISTORY_ITEMS = 5;

export interface FunnyTextInput {
  city: string;
  language: string;
  date: string;
  consensus: ConsensusForecast;
  /** Landmark resolved by the ResolveLandmark pipeline step. */
  landmark: string;
}

export interface FunnyTextOutput {
  funnyText: string;
}

/**
 * Agent 2 — Funny Localized Text Lambda.
 *
 * Step Functions task: invoked after Agent 1 (compare). Takes the
 * ConsensusForecast, queries recent forecast history for this city to avoid
 * repetition, then calls Bedrock Claude Haiku to generate a 2–3 paragraph
 * humorous weather report in the requested language.
 */
export async function handler(input: FunnyTextInput, context: Context): Promise<FunnyTextOutput> {
  const reqLog = log.child({
    requestId: context.awsRequestId,
    city: input.city,
    language: input.language,
  });
  reqLog.info('Agent2_FunnyText starting');

  // Fetch recent history for this city to avoid repetition
  const recentHistory = await fetchRecentHistory(input.city, input.language, reqLog);
  reqLog.info('Fetched recent history', { count: recentHistory.length });

  const { system, user } = buildFunnyTextPrompt({
    consensus: input.consensus,
    city: input.city,
    language: input.language,
    landmark: input.landmark,
    recentHistory,
  });

  // Track Bedrock latency manually so we can emit the metric regardless of success/failure
  const bedrockStart = Date.now();
  let bedrockDurationMs = 0;

  let funnyText: string;
  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      }),
    );

    bedrockDurationMs = Date.now() - bedrockStart;
    emitMetric('BedrockLatency', bedrockDurationMs, 'Milliseconds', { agent: 'funny-text' });
    reqLog.info('Bedrock Haiku - funny-text', { duration_ms: bedrockDurationMs });

    const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as {
      content: Array<{ type: string; text: string }>;
    };
    funnyText = responseBody.content.find((c) => c.type === 'text')?.text?.trim() ?? '';
  } catch (err) {
    bedrockDurationMs = Date.now() - bedrockStart;
    const isThrottle =
      err instanceof Error &&
      (err.name === 'ThrottlingException' || err.message.includes('throttl'));
    if (isThrottle) {
      reqLog.warn('Bedrock throttled on funny-text agent', {
        duration_ms: bedrockDurationMs,
        error: (err as Error).message,
      });
      emitMetric('BedrockThrottled', 1, 'Count', { agent: 'funny-text' });
    } else {
      reqLog.error('Bedrock invocation failed on funny-text agent', {
        duration_ms: bedrockDurationMs,
        error: (err as Error).message,
      });
    }
    throw err;
  }

  if (!funnyText) {
    throw new Error('Agent2_FunnyText: Bedrock returned empty text');
  }

  reqLog.info('Funny text generated', { length: funnyText.length, bedrockDurationMs });

  return { funnyText };
}

/**
 * Query the last N funny texts for this city+language from the Forecasts table
 * via the UserHistoryIndex GSI.
 */
async function fetchRecentHistory(
  city: string,
  language: string,
  reqLog: ReturnType<ReturnType<typeof createLogger>['child']>,
): Promise<string[]> {
  try {
    return await forecastService.listRecentFunnyTexts(city, language, MAX_HISTORY_ITEMS);
  } catch (err) {
    // History is best-effort — don't fail the pipeline if it can't be fetched
    reqLog.warn('Failed to fetch recent history (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

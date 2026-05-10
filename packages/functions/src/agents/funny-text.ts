import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { buildFunnyTextPrompt, createLogger } from '@uweather/core';
import type { ConsensusForecast } from '@uweather/core';
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
}

export interface FunnyTextOutput {
  funnyText: string;
}

/**
 * Agent 2 — Funny Localized Text Lambda.
 *
 * Step Functions task: invoked after Agent 1 (compare). Takes the
 * ConsensusForecast, queries recent forecast history for this city to avoid
 * repetition, then calls Bedrock Claude 3.5 Haiku to generate a 2–3 paragraph
 * humorous weather report in the requested language.
 */
export async function handler(input: FunnyTextInput): Promise<FunnyTextOutput> {
  log.info('Agent2_FunnyText starting', { city: input.city, language: input.language });

  // Fetch recent history for this city to avoid repetition
  const recentHistory = await fetchRecentHistory(input.city, input.language);
  log.info('Fetched recent history', { city: input.city, count: recentHistory.length });

  const { system, user } = buildFunnyTextPrompt({
    consensus: input.consensus,
    city: input.city,
    language: input.language,
    recentHistory,
  });

  const bedrockResponse = await log.timed('Bedrock Haiku - funny-text', () =>
    bedrock.send(
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
    ),
  );

  const responseBody = JSON.parse(
    new TextDecoder().decode((bedrockResponse as { body: Uint8Array }).body),
  ) as { content: Array<{ type: string; text: string }> };

  const funnyText = responseBody.content.find((c) => c.type === 'text')?.text?.trim() ?? '';

  if (!funnyText) {
    throw new Error('Agent2_FunnyText: Bedrock returned empty text');
  }

  log.info('Funny text generated', {
    city: input.city,
    language: input.language,
    length: funnyText.length,
  });

  return { funnyText };
}

/**
 * Query the last N funny texts for this city+language from the Forecasts table
 * via the UserHistoryIndex GSI.
 *
 * Using a simple scan of recent items by imageCacheKey prefix is not ideal —
 * a dedicated GSI for city+language would be cleaner. For now we use the
 * UserHistoryIndex with userId='system' as a city-level history bucket.
 * Phase 4 can refine this once real userId data flows through.
 */
async function fetchRecentHistory(city: string, language: string): Promise<string[]> {
  try {
    return await forecastService.listRecentFunnyTexts(city, language, MAX_HISTORY_ITEMS);
  } catch (err) {
    // History is best-effort — don't fail the pipeline if it can't be fetched
    log.warn('Failed to fetch recent history (non-fatal)', {
      city,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

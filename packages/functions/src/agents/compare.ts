import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { buildComparePrompt, createLogger, emitMetric } from '@uweather/core';
import type { ConsensusForecast, UnifiedWeatherData } from '@uweather/core';
import type { Context } from 'aws-lambda';

const bedrock = new BedrockRuntimeClient({});
const log = createLogger({ function: 'agent-compare' });

/** Claude 4.5 Haiku inference profile ID on Bedrock (required for on-demand throughput) */
const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

type ProviderResult =
  | UnifiedWeatherData
  | { success: boolean; provider: string; data?: UnifiedWeatherData };

export interface CompareInput {
  city: string;
  language: string;
  date: string;
  providerResults: ProviderResult[];
}

export interface CompareOutput {
  consensus: ConsensusForecast;
  sourcesUsed: ('openweather' | 'weatherapi' | 'open-meteo')[];
}

/**
 * Agent 1 — Weather Comparison Lambda.
 *
 * Step Functions task: invoked after FetchWeather (fresh fetch) or directly
 * after a cache hit. Accepts raw provider results, calls Bedrock Claude Haiku
 * to produce a single ConsensusForecast, and returns it along with the
 * list of providers whose data contributed.
 *
 * Hardening: proceeds with as few as 1 provider (low confidence), but logs a
 * warning so operators can track degraded-mode forecasts via CloudWatch.
 */
export async function handler(input: CompareInput, context: Context): Promise<CompareOutput> {
  const reqLog = log.child({ requestId: context.awsRequestId, city: input.city });
  reqLog.info('Agent1_Compare starting', { date: input.date });

  // Normalise — accept both wrapped { success, data } objects and bare UnifiedWeatherData
  const weatherDataArray: UnifiedWeatherData[] = input.providerResults
    .filter(
      (
        r,
      ): r is
        | UnifiedWeatherData
        | { success: true; provider: string; data: UnifiedWeatherData } => {
        if ('success' in r) return r.success === true && r.data != null;
        return true;
      },
    )
    .map((r) =>
      'success' in r && 'data' in r
        ? (r as { success: true; provider: string; data: UnifiedWeatherData }).data
        : (r as UnifiedWeatherData),
    );

  if (weatherDataArray.length === 0) {
    reqLog.error('No successful provider data — cannot produce consensus');
    emitMetric('ProviderCount', 0);
    throw new Error(`Agent1_Compare: no successful provider data for ${input.city}`);
  }

  const sourcesUsed = weatherDataArray.map((w) => w.provider) as (
    | 'openweather'
    | 'weatherapi'
    | 'open-meteo'
  )[];

  // Graceful degradation: 1 provider means low confidence — track it
  emitMetric('ProviderCount', weatherDataArray.length);
  if (weatherDataArray.length === 1) {
    reqLog.warn('Only one provider available — producing low-confidence consensus', {
      provider: sourcesUsed[0],
    });
    emitMetric('LowConfidenceForecast', 1);
  }

  reqLog.info('Comparing weather data', { providers: sourcesUsed });

  const { system, user } = buildComparePrompt({ providers: weatherDataArray });

  // Track Bedrock latency manually so we can emit the metric regardless of success/failure
  const bedrockStart = Date.now();
  let bedrockDurationMs = 0;

  let rawText: string;
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
    emitMetric('BedrockLatency', bedrockDurationMs, 'Milliseconds', { agent: 'compare' });
    reqLog.info('Bedrock Haiku - compare', { duration_ms: bedrockDurationMs });

    const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as {
      content: Array<{ type: string; text: string }>;
    };
    rawText = responseBody.content.find((c) => c.type === 'text')?.text ?? '';
  } catch (err) {
    bedrockDurationMs = Date.now() - bedrockStart;
    const isThrottle =
      err instanceof Error &&
      (err.name === 'ThrottlingException' || err.message.includes('throttl'));
    if (isThrottle) {
      reqLog.warn('Bedrock throttled on compare agent', {
        duration_ms: bedrockDurationMs,
        error: (err as Error).message,
      });
      emitMetric('BedrockThrottled', 1, 'Count', { agent: 'compare' });
    } else {
      reqLog.error('Bedrock invocation failed on compare agent', {
        duration_ms: bedrockDurationMs,
        error: (err as Error).message,
      });
    }
    throw err;
  }

  // Strip accidental markdown fences before parsing
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  let consensus: ConsensusForecast;
  try {
    consensus = JSON.parse(jsonText) as ConsensusForecast;
  } catch {
    reqLog.error('Failed to parse ConsensusForecast JSON', { excerpt: rawText.slice(0, 400) });
    throw new Error('Agent1_Compare: Bedrock response was not valid JSON');
  }

  reqLog.info('Consensus forecast generated', {
    condition: consensus.condition,
    temperature: consensus.temperature,
    confidence: consensus.confidence,
    providerCount: sourcesUsed.length,
    bedrockDurationMs,
  });

  return { consensus, sourcesUsed };
}

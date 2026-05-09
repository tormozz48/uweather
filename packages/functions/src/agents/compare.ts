/**
 * Agent 1 — Weather Comparison Lambda.
 *
 * Step Functions task: invoked after FetchWeather (fresh fetch) or directly
 * after a cache hit. Accepts raw provider results, calls Bedrock Claude 3.5
 * Haiku to produce a single ConsensusForecast, and returns it along with the
 * list of providers whose data contributed.
 *
 * Input shape accepts both:
 *   - Wrapped provider output: { success: boolean; provider: string; data?: UnifiedWeatherData }
 *     (produced by the Parallel FetchWeather branches)
 *   - Direct UnifiedWeatherData array (produced by the cache-hit path)
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { createLogger, buildComparePrompt } from '@uweather/core';
import type { UnifiedWeatherData, ConsensusForecast } from '@uweather/core';

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

export async function handler(input: CompareInput): Promise<CompareOutput> {
  log.info('Agent1_Compare starting', { city: input.city, date: input.date });

  // Normalise — accept both wrapped { success, data } objects and bare UnifiedWeatherData
  const weatherDataArray: UnifiedWeatherData[] = input.providerResults
    .filter((r): r is
      | UnifiedWeatherData
      | { success: true; provider: string; data: UnifiedWeatherData } => {
      if ('success' in r) return r.success === true && r.data != null;
      return true;
    })
    .map((r) =>
      'success' in r && 'data' in r
        ? (r as { success: true; provider: string; data: UnifiedWeatherData }).data
        : (r as UnifiedWeatherData),
    );

  if (weatherDataArray.length === 0) {
    throw new Error(`Agent1_Compare: no successful provider data for ${input.city}`);
  }

  const sourcesUsed = weatherDataArray.map(
    (w) => w.provider,
  ) as ('openweather' | 'weatherapi' | 'open-meteo')[];

  log.info('Comparing weather data', { city: input.city, providers: sourcesUsed });

  const { system, user } = buildComparePrompt({ providers: weatherDataArray });

  const bedrockResponse = await log.timed('Bedrock Haiku - compare', () =>
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

  const rawText = responseBody.content.find((c) => c.type === 'text')?.text ?? '';

  // Strip accidental markdown fences before parsing
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  let consensus: ConsensusForecast;
  try {
    consensus = JSON.parse(jsonText) as ConsensusForecast;
  } catch {
    log.error('Failed to parse ConsensusForecast JSON', { excerpt: rawText.slice(0, 400) });
    throw new Error('Agent1_Compare: Bedrock response was not valid JSON');
  }

  log.info('Consensus forecast generated', {
    city: input.city,
    condition: consensus.condition,
    temperature: consensus.temperature,
    confidence: consensus.confidence,
    providerCount: sourcesUsed.length,
  });

  return { consensus, sourcesUsed };
}

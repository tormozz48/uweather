import { buildComparePrompt, createLogger, emitMetric, stripMarkdownFence } from '@uweather/core';
import type { ConsensusForecast, UnifiedWeatherData } from '@uweather/core';
import type { Context } from 'aws-lambda';
import { callBedrock } from '../lib/bedrock.js';
import { reportStage } from '../lib/report-stage.js';

const log = createLogger({ function: 'agent-compare' });

type ProviderResult =
  | UnifiedWeatherData
  | { success: boolean; provider: string; data?: UnifiedWeatherData };

export interface CompareInput {
  city: string;
  language: string;
  date: string;
  providerResults: ProviderResult[];
  executionArn?: string;
}

export interface CompareOutput {
  consensus: ConsensusForecast;
  sourcesUsed: ('openweather' | 'weatherapi' | 'open-meteo')[];
}

/** Max characters of Bedrock raw response included in error logs. */
const BEDROCK_ERROR_EXCERPT_LENGTH = 400;

/**
 * Normalise raw provider results — accept both wrapped `{ success, data }` objects
 * and bare `UnifiedWeatherData` values. Returns only successful entries.
 */
function normalizeProviderResults(providerResults: ProviderResult[]): UnifiedWeatherData[] {
  return providerResults
    .filter(
      (
        result,
      ): result is
        | UnifiedWeatherData
        | { success: true; provider: string; data: UnifiedWeatherData } => {
        if ('success' in result) return result.success === true && result.data != null;
        return true;
      },
    )
    .map((result) =>
      'success' in result && 'data' in result
        ? (result as { success: true; provider: string; data: UnifiedWeatherData }).data
        : (result as UnifiedWeatherData),
    );
}

/**
 * Parse the Bedrock JSON response into a ConsensusForecast.
 * Throws a descriptive error when the text is not valid JSON.
 */
function parseConsensusForecast(rawText: string): ConsensusForecast {
  const jsonText = stripMarkdownFence(rawText);
  try {
    return JSON.parse(jsonText) as ConsensusForecast;
  } catch {
    throw new Error(
      `Agent1_Compare: Bedrock response was not valid JSON — excerpt: ${rawText.slice(0, BEDROCK_ERROR_EXCERPT_LENGTH)}`,
    );
  }
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
  if (input.executionArn) await reportStage(input.executionArn, 'compare', 'started');
  reqLog.info('Agent1_Compare starting', { date: input.date });

  const weatherDataArray = normalizeProviderResults(input.providerResults);

  if (weatherDataArray.length === 0) {
    reqLog.error('No successful provider data — cannot produce consensus');
    emitMetric('ProviderCount', 0);
    throw new Error(`Agent1_Compare: no successful provider data for ${input.city}`);
  }

  const sourcesUsed = weatherDataArray.map((weatherData) => weatherData.provider) as (
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
  const rawText = await callBedrock({ system, user, agent: 'compare', log: reqLog });

  const consensus = parseConsensusForecast(rawText);

  reqLog.info('Consensus forecast generated', {
    condition: consensus.condition,
    temperature: consensus.temperature,
    confidence: consensus.confidence,
    providerCount: sourcesUsed.length,
  });

  if (input.executionArn) await reportStage(input.executionArn, 'compare', 'done');
  return { consensus, sourcesUsed };
}

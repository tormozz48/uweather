import { buildComparePrompt, createLogger, emitMetric } from '@uweather/core';
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

  const rawText = await callBedrock({ system, user, agent: 'compare', log: reqLog });

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
  });

  if (input.executionArn) await reportStage(input.executionArn, 'compare', 'done');
  return { consensus, sourcesUsed };
}

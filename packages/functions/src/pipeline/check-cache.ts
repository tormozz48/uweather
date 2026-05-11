import { createLogger, emitMetric, normalizeCity } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';
import type { Context } from 'aws-lambda';
import { reportStage } from '../lib/report-stage.js';
import { weatherCacheService } from '../services/index.js';

const log = createLogger({ function: 'pipeline-check-cache' });

const CACHE_FRESH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface CheckCacheInput {
  city: string;
  language: string;
  date: string; // YYYY-MM-DD
  executionArn?: string;
}

export interface CheckCacheOutput {
  cacheHit: boolean;
  /** Present when cacheHit=true; the fresh provider data found in cache. */
  providers?: UnifiedWeatherData[];
}

/**
 * CheckCache Step Functions task Lambda.
 *
 * First state in the forecast pipeline. Queries WeatherCache for the given city
 * and today's date. Returns cacheHit=true if ≥2 providers have data fetched
 * within the last 30 minutes.
 *
 * If cacheHit=true, the Step Functions Choice state skips FetchWeather and
 * proceeds directly to agents (added in Phase 3).
 */
export async function handler(input: CheckCacheInput, context: Context): Promise<CheckCacheOutput> {
  const reqLog = log.child({ requestId: context.awsRequestId, city: input.city });
  const { city, date, executionArn } = input;
  if (executionArn) await reportStage(executionArn, 'cache', 'started');
  const cityNormalized = normalizeCity(city);

  reqLog.info('Checking WeatherCache', { city: cityNormalized, date });

  const items = await weatherCacheService.load(cityNormalized, date);
  const cutoffMs = Date.now() - CACHE_FRESH_WINDOW_MS;

  const freshItems = items.filter((item) => new Date(item.fetchedAt).getTime() > cutoffMs);

  const freshProviders = freshItems.map((item) => item.data);
  const cacheHit = freshItems.length >= 2;

  reqLog.info('Cache check complete', {
    city: cityNormalized,
    totalItems: items.length,
    freshItems: freshItems.length,
    cacheHit,
  });

  // Emit custom metric for cache hit rate tracking
  emitMetric(cacheHit ? 'WeatherCacheHit' : 'WeatherCacheMiss', 1);

  if (executionArn) await reportStage(executionArn, 'cache', 'done');

  if (cacheHit) {
    return { cacheHit: true, providers: freshProviders };
  }

  return { cacheHit: false };
}

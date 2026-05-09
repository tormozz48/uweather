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
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { createLogger, normalizeCity } from '@uweather/core';
import type { UnifiedWeatherData, WeatherCacheEntry } from '@uweather/core';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const log = createLogger({ function: 'pipeline-check-cache' });

const CACHE_FRESH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface CheckCacheInput {
  city: string;
  language: string;
  date: string; // YYYY-MM-DD
}

export interface CheckCacheOutput {
  cacheHit: boolean;
  /** Present when cacheHit=true; the fresh provider data found in cache. */
  providers?: UnifiedWeatherData[];
}

export async function handler(input: CheckCacheInput): Promise<CheckCacheOutput> {
  const { city, date } = input;
  const cityNormalized = normalizeCity(city);

  log.info('Checking WeatherCache', { city: cityNormalized, date });

  const result = await dynamo.send(
    new QueryCommand({
      TableName: Resource.WeatherCache.name,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :datePrefix)',
      ExpressionAttributeValues: {
        ':pk': `CACHE#${cityNormalized}`,
        ':datePrefix': `${date}#`,
      },
    }),
  );

  const items = (result.Items ?? []) as WeatherCacheEntry[];
  const cutoffMs = Date.now() - CACHE_FRESH_WINDOW_MS;

  const freshItems = items.filter(
    (item) => new Date(item.fetchedAt).getTime() > cutoffMs,
  );

  const freshProviders = freshItems.map((item) => item.data);

  log.info('Cache check complete', {
    city: cityNormalized,
    totalItems: items.length,
    freshItems: freshItems.length,
    cacheHit: freshItems.length >= 2,
  });

  if (freshItems.length >= 2) {
    return { cacheHit: true, providers: freshProviders };
  }

  return { cacheHit: false };
}

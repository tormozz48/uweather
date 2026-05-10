import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { UnifiedWeatherData, WeatherCacheEntry, WeatherProvider } from '@uweather/core';
import { Resource } from 'sst';
import { dynamo } from './db-client.js';

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

export interface SaveCacheInput<P extends WeatherProvider = WeatherProvider> {
  /** City name (lowercase, ASCII) */
  city: string;
  /** Date string in YYYY-MM-DD format */
  date: string;
  /** Provider slug: 'openweather' | 'weatherapi' | 'open-meteo' */
  provider: P;
  /** Normalized UnifiedWeatherData from the provider */
  data: UnifiedWeatherData;
}

/**
 * WeatherCacheService — high-level access to the WeatherCache DynamoDB table.
 *
 * Table schema:
 *   PK: CACHE#{city_normalized}
 *   SK: {date}#{provider}
 *   TTL: 30 minutes from fetch time (auto-deleted by DynamoDB)
 */
export class WeatherCacheService {
  /**
   * Load all provider cache entries for a city on a given date.
   * Returns an empty array when no entries exist or all have expired.
   */
  async load(city: string, date: string): Promise<WeatherCacheEntry[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: Resource.WeatherCache.name,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :datePrefix)',
        ExpressionAttributeValues: {
          ':pk': `CACHE#${city}`,
          ':datePrefix': `${date}#`,
        },
      }),
    );
    return (result.Items ?? []) as WeatherCacheEntry[];
  }

  /**
   * Save a provider's weather data with a 30-minute TTL.
   */
  async save<P extends WeatherProvider>({
    city,
    date,
    provider,
    data,
  }: SaveCacheInput<P>): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS;
    await dynamo.send(
      new PutCommand({
        TableName: Resource.WeatherCache.name,
        Item: {
          pk: `CACHE#${city}`,
          sk: `${date}#${provider}`,
          data,
          fetchedAt: data.fetchedAt,
          ttl,
        },
      }),
    );
  }
}

export const weatherCacheService = new WeatherCacheService();

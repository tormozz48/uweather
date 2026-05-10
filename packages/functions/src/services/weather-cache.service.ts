/**
 * WeatherCacheService — high-level access to the WeatherCache DynamoDB table.
 *
 * Table schema:
 *   PK: CACHE#{city_normalized}
 *   SK: {date}#{provider}
 *   TTL: 30 minutes from fetch time (auto-deleted by DynamoDB)
 */
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { UnifiedWeatherData, WeatherCacheEntry } from '@uweather/core';
import { Resource } from 'sst';
import { dynamo } from './db-client.js';

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

export class WeatherCacheService {
  /**
   * Load all provider cache entries for a city on a given date.
   * Returns an empty array when no entries exist or all have expired.
   */
  async load(cityNormalized: string, date: string): Promise<WeatherCacheEntry[]> {
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
    return (result.Items ?? []) as WeatherCacheEntry[];
  }

  /**
   * Save a provider's weather data with a 30-minute TTL.
   *
   * @param cityNormalized - Normalized city name (lowercase, ASCII)
   * @param date           - Date string in YYYY-MM-DD format
   * @param provider       - Provider slug: 'openweather' | 'weatherapi' | 'open-meteo'
   * @param data           - Normalized UnifiedWeatherData from the provider
   */
  async save(
    cityNormalized: string,
    date: string,
    provider: string,
    data: UnifiedWeatherData,
  ): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS;
    await dynamo.send(
      new PutCommand({
        TableName: Resource.WeatherCache.name,
        Item: {
          pk: `CACHE#${cityNormalized}`,
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

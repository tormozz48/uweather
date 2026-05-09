/**
 * WeatherAPI provider Lambda.
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Fetches current weather, transforms to UnifiedWeatherData, and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { createLogger, normalizeCity } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';
import { fetchWeatherAPI } from './weatherapi.client.js';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const log = createLogger({ function: 'provider-weatherapi' });

export interface ProviderInput {
  city: string; // Already normalized by orchestrator
  language: string;
  date: string; // YYYY-MM-DD
}

export interface ProviderOutput {
  provider: 'weatherapi';
  success: true;
  data: UnifiedWeatherData;
}

export async function handler(input: ProviderInput): Promise<ProviderOutput> {
  const { city, date } = input;
  log.info('Fetching weather from WeatherAPI', { city });

  const data = await fetchWeatherAPI(city, Resource.WeatherApiKey.value);

  // Write to WeatherCache
  const cityNormalized = normalizeCity(city);
  const ttl = Math.floor(Date.now() / 1000) + 30 * 60; // 30 min TTL

  await dynamo.send(
    new PutCommand({
      TableName: Resource.WeatherCache.name,
      Item: {
        pk: `CACHE#${cityNormalized}`,
        sk: `${date}#weatherapi`,
        data,
        fetchedAt: data.fetchedAt,
        ttl,
      },
    }),
  );

  log.info('Weather cached', { city: cityNormalized, provider: 'weatherapi', date });
  return { provider: 'weatherapi', success: true, data };
}

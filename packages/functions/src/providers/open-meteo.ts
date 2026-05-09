/**
 * Open-Meteo provider Lambda (no API key required).
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Transforms to UnifiedWeatherData and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { createLogger, normalizeCity } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';
import { fetchOpenMeteo } from './open-meteo.client.js';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const log = createLogger({ function: 'provider-open-meteo' });

export interface ProviderInput {
  city: string; // Already normalized by orchestrator
  language: string;
  date: string; // YYYY-MM-DD
}

export interface ProviderOutput {
  provider: 'open-meteo';
  success: true;
  data: UnifiedWeatherData;
}

export async function handler(input: ProviderInput): Promise<ProviderOutput> {
  const { city, date } = input;
  log.info('Fetching weather from Open-Meteo', { city });

  const data = await fetchOpenMeteo(city);

  // Write to WeatherCache
  const cityNormalized = normalizeCity(city);
  const ttl = Math.floor(Date.now() / 1000) + 30 * 60; // 30 min TTL

  await dynamo.send(
    new PutCommand({
      TableName: Resource.WeatherCache.name,
      Item: {
        pk: `CACHE#${cityNormalized}`,
        sk: `${date}#open-meteo`,
        data,
        fetchedAt: data.fetchedAt,
        ttl,
      },
    }),
  );

  log.info('Weather cached', { city: cityNormalized, provider: 'open-meteo', date });
  return { provider: 'open-meteo', success: true, data };
}

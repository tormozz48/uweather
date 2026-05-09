/**
 * OpenWeatherMap provider Lambda.
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Fetches current weather, transforms to UnifiedWeatherData, and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { transformOpenWeather } from '@uweather/core';
import { createLogger, normalizeCity, toDateString } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const log = createLogger({ function: 'provider-openweather' });

export interface ProviderInput {
  city: string; // Already normalized by orchestrator
  language: string;
  date: string; // YYYY-MM-DD
}

export interface ProviderOutput {
  provider: 'openweather';
  success: true;
  data: UnifiedWeatherData;
}

export async function handler(input: ProviderInput): Promise<ProviderOutput> {
  const { city, date } = input;
  log.info('Fetching weather from OpenWeatherMap', { city });

  const apiKey = Resource.OpenWeatherApiKey.value;
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenWeatherMap API error ${response.status}: ${body}`);
  }

  const raw: unknown = await response.json();
  const data = transformOpenWeather(raw);

  // Write to WeatherCache
  const cityNormalized = normalizeCity(city);
  const ttl = Math.floor(Date.now() / 1000) + 30 * 60; // 30 min TTL

  await dynamo.send(
    new PutCommand({
      TableName: Resource.WeatherCache.name,
      Item: {
        pk: `CACHE#${cityNormalized}`,
        sk: `${date}#openweather`,
        data,
        rawResponse: JSON.stringify(raw),
        fetchedAt: data.fetchedAt,
        ttl,
      },
    }),
  );

  log.info('Weather cached', { city: cityNormalized, provider: 'openweather', date });
  return { provider: 'openweather', success: true, data };
}

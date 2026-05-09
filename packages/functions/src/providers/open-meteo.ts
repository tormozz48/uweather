/**
 * Open-Meteo provider Lambda (no API key required).
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Two-step fetch: geocoding API → weather forecast API.
 * Transforms to UnifiedWeatherData and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { transformOpenMeteo } from '@uweather/core';
import { createLogger, normalizeCity } from '@uweather/core';
import type { OMGeocodingResponse, OMWeatherResponse, UnifiedWeatherData } from '@uweather/core';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const log = createLogger({ function: 'provider-open-meteo' });

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_PARAMS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'visibility',
  'is_day',
].join(',');

const DAILY_PARAMS = ['sunrise', 'sunset', 'uv_index_max'].join(',');

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

  // Step 1: Geocode the city name to lat/lon
  const geoUrl = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const geoResponse = await fetch(geoUrl);
  if (!geoResponse.ok) {
    throw new Error(`Open-Meteo geocoding error ${geoResponse.status}`);
  }

  const geoData = (await geoResponse.json()) as OMGeocodingResponse;
  const geoResult = geoData.results?.[0];
  if (!geoResult) {
    throw new Error(`Open-Meteo: city not found — "${city}"`);
  }

  log.info('Geocoded city', {
    city,
    resolvedName: geoResult.name,
    lat: geoResult.latitude,
    lon: geoResult.longitude,
  });

  // Step 2: Fetch current weather + daily UV/sunrise/sunset
  const weatherUrl =
    `${FORECAST_URL}` +
    `?latitude=${geoResult.latitude}` +
    `&longitude=${geoResult.longitude}` +
    `&current=${CURRENT_PARAMS}` +
    `&daily=${DAILY_PARAMS}` +
    `&timezone=UTC` +
    `&forecast_days=1`;

  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    throw new Error(`Open-Meteo forecast error ${weatherResponse.status}`);
  }

  const weatherData = (await weatherResponse.json()) as OMWeatherResponse;
  const data = transformOpenMeteo(geoResult, weatherData);

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
        rawResponse: JSON.stringify({ geo: geoResult, weather: weatherData }),
        fetchedAt: data.fetchedAt,
        ttl,
      },
    }),
  );

  log.info('Weather cached', { city: cityNormalized, provider: 'open-meteo', date });
  return { provider: 'open-meteo', success: true, data };
}

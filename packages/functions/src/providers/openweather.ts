import { createLogger, normalizeCity } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';
/**
 * OpenWeatherMap provider Lambda.
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Fetches current weather, transforms to UnifiedWeatherData, and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
import { Resource } from 'sst';
import { weatherCacheService } from '../services/index.js';
import { fetchOpenWeather } from './openweather.client.js';

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

  const data = await fetchOpenWeather(city, Resource.OpenWeatherApiKey.value);

  const cityNormalized = normalizeCity(city);
  await weatherCacheService.save(cityNormalized, date, 'openweather', data);

  log.info('Weather cached', { city: cityNormalized, provider: 'openweather', date });
  return { provider: 'openweather', success: true, data };
}

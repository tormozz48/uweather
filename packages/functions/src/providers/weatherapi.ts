import { createLogger, normalizeCity } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';
/**
 * WeatherAPI provider Lambda.
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Fetches current weather, transforms to UnifiedWeatherData, and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
import { Resource } from 'sst';
import { weatherCacheService } from '../services/index.js';
import { fetchWeatherAPI } from './weatherapi.client.js';

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

  const cityNormalized = normalizeCity(city);
  await weatherCacheService.save(cityNormalized, date, 'weatherapi', data);

  log.info('Weather cached', { city: cityNormalized, provider: 'weatherapi', date });
  return { provider: 'weatherapi', success: true, data };
}

import { createLogger, normalizeCity } from '@uweather/core';
import type { ProviderInput, ProviderOutput } from '@uweather/core';
import { Resource } from 'sst';
import { weatherCacheService } from '../services/index.js';
import { fetchWeatherAPI } from './weatherapi.client.js';

export type { ProviderInput, ProviderOutput };

const PROVIDER_NAME = 'weatherapi';
const log = createLogger({ function: `provider-${PROVIDER_NAME}` });

/**
 * WeatherAPI provider Lambda.
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Fetches current weather, transforms to UnifiedWeatherData, and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
export async function handler(input: ProviderInput): Promise<ProviderOutput<typeof PROVIDER_NAME>> {
  const { city, date } = input;
  log.info('Fetching weather from WeatherAPI', { city });

  const data = await fetchWeatherAPI(city, Resource.WeatherApiKey.value);

  const cityNormalized = normalizeCity(city);
  await weatherCacheService.save(cityNormalized, date, PROVIDER_NAME, data);

  log.info('Weather cached', { city: cityNormalized, provider: PROVIDER_NAME, date });
  return { provider: PROVIDER_NAME, success: true, data };
}

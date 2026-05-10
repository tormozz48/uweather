import { createLogger, normalizeCity } from '@uweather/core';
import type { ProviderInput, ProviderOutput } from '@uweather/core';
import { weatherCacheService } from '../services/index.js';
import { fetchOpenMeteo } from './open-meteo.client.js';

export type { ProviderInput, ProviderOutput };

const PROVIDER_NAME = 'open-meteo';
const log = createLogger({ function: `provider-${PROVIDER_NAME}` });

/**
 * Open-Meteo provider Lambda (no API key required).
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Transforms to UnifiedWeatherData and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
export async function handler(input: ProviderInput): Promise<ProviderOutput<typeof PROVIDER_NAME>> {
  const { city, date } = input;
  log.info('Fetching weather from Open-Meteo', { city });

  const data = await fetchOpenMeteo(city);

  const cityNormalized = normalizeCity(city);
  await weatherCacheService.save({ city: cityNormalized, date, provider: PROVIDER_NAME, data });

  log.info('Weather cached', { city: cityNormalized, provider: PROVIDER_NAME, date });
  return { provider: PROVIDER_NAME, success: true, data };
}

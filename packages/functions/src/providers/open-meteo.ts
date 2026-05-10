/**
 * Open-Meteo provider Lambda (no API key required).
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Transforms to UnifiedWeatherData and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
import { createLogger, normalizeCity } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';
import { weatherCacheService } from '../services/index.js';
import { fetchOpenMeteo } from './open-meteo.client.js';

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

  const cityNormalized = normalizeCity(city);
  await weatherCacheService.save(cityNormalized, date, 'open-meteo', data);

  log.info('Weather cached', { city: cityNormalized, provider: 'open-meteo', date });
  return { provider: 'open-meteo', success: true, data };
}

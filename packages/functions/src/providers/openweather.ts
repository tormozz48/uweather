import { createLogger, emitMetric, normalizeCity } from '@uweather/core';
import type { ProviderInput, ProviderOutput } from '@uweather/core';
import type { Context } from 'aws-lambda';
import { Resource } from 'sst';
import { weatherCacheService } from '../services/index.js';
import { fetchOpenWeather } from './openweather.client.js';

export type { ProviderInput, ProviderOutput };

const PROVIDER_NAME = 'openweather';
const log = createLogger({ function: `provider-${PROVIDER_NAME}` });

/**
 * OpenWeatherMap provider Lambda.
 *
 * Invoked as a Step Functions task inside the FetchWeather parallel state.
 * Fetches current weather, transforms to UnifiedWeatherData, and writes to WeatherCache.
 *
 * Throws on any failure so Step Functions retry/catch logic engages.
 */
export async function handler(
  input: ProviderInput,
  context: Context,
): Promise<ProviderOutput<typeof PROVIDER_NAME>> {
  const { city, date } = input;
  const reqLog = log.child({ requestId: context.awsRequestId, city, provider: PROVIDER_NAME });
  reqLog.info('Fetching weather from OpenWeatherMap');

  try {
    const coords = input.lat !== undefined && input.lon !== undefined
      ? { lat: input.lat, lon: input.lon }
      : undefined;
    const data = await fetchOpenWeather(city, Resource.OpenWeatherApiKey.value, coords);

    const cityNormalized = normalizeCity(city);
    await weatherCacheService.save({ city: cityNormalized, date, provider: PROVIDER_NAME, data });

    reqLog.info('Weather cached', { city: cityNormalized, date });
    emitMetric('ProviderSuccess', 1, 'Count', { provider: PROVIDER_NAME });
    return { provider: PROVIDER_NAME, success: true, data };
  } catch (err) {
    reqLog.error('Provider fetch failed', { error: (err as Error).message });
    emitMetric('ProviderError', 1, 'Count', { provider: PROVIDER_NAME });
    throw err;
  }
}

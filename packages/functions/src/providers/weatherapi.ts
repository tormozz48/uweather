import { createLogger, emitMetric, normalizeCity } from '@uweather/core';
import type { ProviderInput, ProviderOutput } from '@uweather/core';
import type { Context } from 'aws-lambda';
import { Resource } from 'sst';
import { reportStage } from '../lib/report-stage.js';
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
export async function handler(
  input: ProviderInput,
  context: Context,
): Promise<ProviderOutput<typeof PROVIDER_NAME>> {
  const { city, date, executionArn } = input;
  const reqLog = log.child({ requestId: context.awsRequestId, city, provider: PROVIDER_NAME });
  reqLog.info('Fetching weather from WeatherAPI');

  if (executionArn) await reportStage(executionArn, 'fetch_weatherapi', 'started');

  try {
    const coords =
      input.lat !== undefined && input.lon !== undefined
        ? { lat: input.lat, lon: input.lon }
        : undefined;
    const data = await fetchWeatherAPI(city, Resource.WeatherApiKey.value, coords);

    const cityNormalized = normalizeCity(city);
    await weatherCacheService.save({ city: cityNormalized, date, provider: PROVIDER_NAME, data });

    reqLog.info('Weather cached', { city: cityNormalized, date });
    emitMetric('ProviderSuccess', 1, 'Count', { provider: PROVIDER_NAME });
    if (executionArn) await reportStage(executionArn, 'fetch_weatherapi', 'done');
    return { provider: PROVIDER_NAME, success: true, data };
  } catch (err) {
    reqLog.error('Provider fetch failed', { error: (err as Error).message });
    emitMetric('ProviderError', 1, 'Count', { provider: PROVIDER_NAME });
    throw err;
  }
}

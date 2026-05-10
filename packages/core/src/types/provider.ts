import type { UnifiedWeatherData } from './weather.js';

export type WeatherProvider = 'open-meteo' | 'openweather' | 'weatherapi';

/** Input shape shared by all provider Lambdas (passed from Step Functions). */
export interface ProviderInput {
  city: string; // Already normalized by orchestrator
  language: string;
  date: string; // YYYY-MM-DD
}

/** Output shape for a successful provider Lambda invocation. */
export interface ProviderOutput<P extends WeatherProvider> {
  provider: P;
  success: true;
  data: UnifiedWeatherData;
}

import type { UnifiedWeatherData } from './weather.js';

export type WeatherProvider = 'open-meteo' | 'openweather' | 'weatherapi';

/** Input shape shared by all provider Lambdas (passed from Step Functions). */
export interface ProviderInput {
  city: string; // Already normalized by orchestrator
  language: string;
  date: string; // YYYY-MM-DD
  /** Pre-resolved coordinates from the client's geocoding selection. When present,
   *  provider clients skip their own geocoding / city-string lookup and query by
   *  lat/lon directly — eliminating city-name ambiguity. */
  lat?: number;
  lon?: number;
  /** Step Functions execution ARN injected via $$.Execution.Id.
   *  Used by each provider to emit StageProgress events to EventBridge
   *  so the WebSocket push Lambda can relay progress to the frontend. */
  executionArn?: string;
}

/** Output shape for a successful provider Lambda invocation. */
export interface ProviderOutput<P extends WeatherProvider> {
  provider: P;
  success: true;
  data: UnifiedWeatherData;
}

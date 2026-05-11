import type { ConsensusForecast } from './weather.js';

/**
 * Complete forecast stored in DynamoDB Forecasts table.
 */
export interface ForecastResult {
  forecastId: string; // ULID
  userId: string; // web sessionId
  city: string; // normalized city name
  country: string; // country code
  date: string; // YYYY-MM-DD
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
  language: string; // ISO 639-1
  weatherSummary: ConsensusForecast;
  funnyText: string; // Agent 2 output
  imageUrl: string; // CloudFront URL
  imageCacheKey: string; // cache key used for image lookup/storage
  sourcesUsed: ('openweather' | 'weatherapi' | 'open-meteo')[]; // providers that contributed
  createdAt: string; // ISO 8601
}

/**
 * API response shape returned by GET /forecast.
 */
export interface ForecastResponse {
  forecastId: string;
  city: string;
  country: string;
  date: string;
  weather: {
    temperature: number;
    feelsLike: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    windDirection: string;
    precipitation: number;
    uvIndex: number;
  };
  funnyText: string;
  imageUrl: string;
  language: string;
  createdAt: string;
}

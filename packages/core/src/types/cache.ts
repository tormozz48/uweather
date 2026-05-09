import type { UnifiedWeatherData } from './weather.js';

/**
 * Row in the WeatherCache DynamoDB table.
 * PK: `CACHE#{city_normalized}`, SK: `{date}#{provider}`
 */
export interface WeatherCacheEntry {
  pk: string;
  sk: string;
  data: UnifiedWeatherData;
  /** Original provider response (stringified JSON, for debugging) */
  rawResponse: string;
  fetchedAt: string; // ISO 8601
  /** Unix epoch seconds — DynamoDB TTL field (30 min from fetchedAt) */
  ttl: number;
}

/**
 * Represents a cached image lookup result from the ImageCacheIndex GSI.
 * Projected fields from the Forecasts table.
 */
export interface ImageCacheEntry {
  imageCacheKey: string;
  imageUrl: string;
  funnyText: string;
  weatherSummary: object;
  createdAt: string; // ISO 8601
}

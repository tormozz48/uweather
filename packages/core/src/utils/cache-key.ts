import type { WeatherCondition } from '../types/weather.js';
import { normalizeCity } from './city.js';
import type { TimeSlot } from './time.js';

export type TempBucket = 'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot';

const TEMP_FREEZING_MAX_C = 0;
const TEMP_COLD_MAX_C = 10;
const TEMP_COOL_MAX_C = 18;
const TEMP_MILD_MAX_C = 24;
const TEMP_WARM_MAX_C = 30;

/**
 * Map a consensus temperature (Celsius) to a named bucket.
 *
 * freezing: < 0°C
 * cold:      0–10°C
 * cool:     10–18°C
 * mild:     18–24°C
 * warm:     24–30°C
 * hot:      > 30°C
 */
export function getTempBucket(celsius: number): TempBucket {
  if (celsius < TEMP_FREEZING_MAX_C) return 'freezing';
  if (celsius < TEMP_COLD_MAX_C) return 'cold';
  if (celsius < TEMP_COOL_MAX_C) return 'cool';
  if (celsius < TEMP_MILD_MAX_C) return 'mild';
  if (celsius < TEMP_WARM_MAX_C) return 'warm';
  return 'hot';
}

export interface ImageCacheKeyParams {
  city: string;
  date: string; // YYYY-MM-DD
  timeSlot: TimeSlot;
  condition: WeatherCondition;
  temperature: number; // Celsius
}

/**
 * Build the image cache key used for S3 storage and the ImageCacheIndex GSI lookup.
 * Format: `{city_normalized}:{date}:{timeSlot}:{condition}:{tempBucket}`
 *
 * Example: `kyiv:2026-05-09:afternoon:sunny:warm`
 */
export function buildImageCacheKey(params: ImageCacheKeyParams): string {
  const city = normalizeCity(params.city);
  const tempBucket = getTempBucket(params.temperature);
  return `${city}:${params.date}:${params.timeSlot}:${params.condition}:${tempBucket}`;
}

/**
 * Derive the S3 object key from an image cache key.
 * Format: `images/{imageCacheKey}.png`
 */
export function buildS3ImageKey(imageCacheKey: string): string {
  return `images/${imageCacheKey}.png`;
}

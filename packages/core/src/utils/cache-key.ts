import type { WeatherCondition } from '../types/weather.js';
import { normalizeCity } from './city.js';
import type { TimeSlot } from './time.js';

export type TempBucket = 'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot';

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
  if (celsius < 0) return 'freezing';
  if (celsius < 10) return 'cold';
  if (celsius < 18) return 'cool';
  if (celsius < 24) return 'mild';
  if (celsius < 30) return 'warm';
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

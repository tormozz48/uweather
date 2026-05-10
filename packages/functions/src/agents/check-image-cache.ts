/**
 * CheckImageCache Lambda — Step Functions task.
 *
 * Checks the ImageCacheIndex GSI on the Forecasts table to see if an image
 * already exists for this city+date+timeSlot+condition+tempBucket combination.
 *
 * Returns:
 *   { cacheHit: true,  imageUrl: string, imageCacheKey: string } — skip image gen
 *   { cacheHit: false, imageCacheKey: string }                    — generate image
 */
import { buildImageCacheKey, createLogger } from '@uweather/core';
import type { ConsensusForecast, TimeSlot } from '@uweather/core';
import { forecastService } from '../services/index.js';

const log = createLogger({ function: 'check-image-cache' });

export interface CheckImageCacheInput {
  city: string;
  date: string;
  timeSlot: TimeSlot;
  consensus: ConsensusForecast;
}

export type CheckImageCacheOutput =
  | { cacheHit: true; imageUrl: string; imageCacheKey: string }
  | { cacheHit: false; imageCacheKey: string };

export async function handler(input: CheckImageCacheInput): Promise<CheckImageCacheOutput> {
  const imageCacheKey = buildImageCacheKey({
    city: input.city,
    date: input.date,
    timeSlot: input.timeSlot,
    condition: input.consensus.condition,
    temperature: input.consensus.temperature,
  });

  log.info('Checking image cache', { imageCacheKey });

  const imageUrl = await forecastService.findImageUrl(imageCacheKey);

  if (imageUrl) {
    log.info('Image cache hit', { imageCacheKey, imageUrl });
    return { cacheHit: true, imageUrl, imageCacheKey };
  }

  log.info('Image cache miss', { imageCacheKey });
  return { cacheHit: false, imageCacheKey };
}

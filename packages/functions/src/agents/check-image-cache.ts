import { buildImageCacheKey, createLogger, emitMetric } from '@uweather/core';
import type { ConsensusForecast, TimeSlot } from '@uweather/core';
import type { Context } from 'aws-lambda';
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
export async function handler(
  input: CheckImageCacheInput,
  context: Context,
): Promise<CheckImageCacheOutput> {
  const imageCacheKey = buildImageCacheKey({
    city: input.city,
    date: input.date,
    timeSlot: input.timeSlot,
    condition: input.consensus.condition,
    temperature: input.consensus.temperature,
  });

  const reqLog = log.child({ requestId: context.awsRequestId, city: input.city, imageCacheKey });
  reqLog.info('Checking image cache');

  const imageUrl = await forecastService.findImageUrl(imageCacheKey);

  if (imageUrl) {
    reqLog.info('Image cache hit', { imageUrl });
    emitMetric('ImageCacheHit', 1);
    return { cacheHit: true, imageUrl, imageCacheKey };
  }

  reqLog.info('Image cache miss');
  emitMetric('ImageCacheMiss', 1);
  return { cacheHit: false, imageCacheKey };
}

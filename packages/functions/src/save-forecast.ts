/**
 * SaveForecast Lambda — Step Functions task.
 *
 * Final write step of the pipeline. Receives the assembled forecast data
 * (consensus weather, funny text, image URL, metadata) and writes a complete
 * ForecastResult record to the Forecasts DynamoDB table.
 *
 * The record is keyed by a ULID forecastId, and also stores userId + createdAt
 * so the UserHistoryIndex GSI supports the "show my past forecasts" query.
 * The imageCacheKey is stored so the ImageCacheIndex GSI supports image reuse.
 */
import { createLogger } from '@uweather/core';
import type { ConsensusForecast, TimeSlot } from '@uweather/core';
import { forecastService } from './services/index.js';

const log = createLogger({ function: 'save-forecast' });

export interface SaveForecastInput {
  city: string;
  language: string;
  date: string;
  userId: string;
  timeSlot: TimeSlot;
  consensus: ConsensusForecast;
  funnyText: string;
  imageUrl: string;
  imageCacheKey: string;
  sourcesUsed: ('openweather' | 'weatherapi' | 'open-meteo')[];
}

export interface SaveForecastOutput {
  forecastId: string;
  imageUrl: string;
  city: string;
  date: string;
}

export async function handler(input: SaveForecastInput): Promise<SaveForecastOutput> {
  log.info('Saving forecast', {
    city: input.city,
    language: input.language,
    userId: input.userId,
    timeSlot: input.timeSlot,
    imageCacheKey: input.imageCacheKey,
  });

  const forecastId = await forecastService.save({
    userId: input.userId,
    city: input.city,
    country: input.consensus.country,
    date: input.date,
    timeSlot: input.timeSlot,
    language: input.language,
    weatherSummary: input.consensus,
    funnyText: input.funnyText,
    imageUrl: input.imageUrl,
    imageCacheKey: input.imageCacheKey,
    sourcesUsed: input.sourcesUsed,
  });

  log.info('Forecast saved', { forecastId, city: input.city });

  return {
    forecastId,
    imageUrl: input.imageUrl,
    city: input.city,
    date: input.date,
  };
}

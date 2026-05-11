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
import type { Context } from 'aws-lambda';
import { reportStage } from './lib/report-stage.js';
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
  executionArn?: string;
}

export interface SaveForecastOutput {
  forecastId: string;
  imageUrl: string;
  city: string;
  date: string;
}

export async function handler(
  input: SaveForecastInput,
  context: Context,
): Promise<SaveForecastOutput> {
  const reqLog = log.child({
    requestId: context.awsRequestId,
    city: input.city,
    userId: input.userId,
  });

  if (input.executionArn) await reportStage(input.executionArn, 'save', 'started');
  reqLog.info('Saving forecast', {
    language: input.language,
    timeSlot: input.timeSlot,
    imageCacheKey: input.imageCacheKey,
    sourcesUsed: input.sourcesUsed,
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

  reqLog.info('Forecast saved', { forecastId });
  if (input.executionArn) await reportStage(input.executionArn, 'save', 'done');

  return {
    forecastId,
    imageUrl: input.imageUrl,
    city: input.city,
    date: input.date,
  };
}

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
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { ulid } from 'ulid';
import { createLogger } from '@uweather/core';
import type { ConsensusForecast, ForecastResult, TimeSlot } from '@uweather/core';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
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
  const forecastId = ulid();
  const createdAt = new Date().toISOString();

  log.info('Saving forecast', {
    forecastId,
    city: input.city,
    language: input.language,
    userId: input.userId,
    timeSlot: input.timeSlot,
    imageCacheKey: input.imageCacheKey,
  });

  const record: ForecastResult & { pk: string; sk: string } = {
    pk: `FORECAST#${forecastId}`,
    sk: 'META',
    forecastId,
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
    createdAt,
  };

  await dynamo.send(
    new PutCommand({
      TableName: Resource.Forecasts.name,
      Item: record,
    }),
  );

  log.info('Forecast saved', { forecastId, city: input.city });

  return {
    forecastId,
    imageUrl: input.imageUrl,
    city: input.city,
    date: input.date,
  };
}

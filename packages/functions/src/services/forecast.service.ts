/**
 * ForecastService — high-level access to the Forecasts DynamoDB table.
 *
 * Table schema:
 *   PK: FORECAST#{forecastId}   SK: META
 *
 * GSIs:
 *   UserHistoryIndex  — pk=userId,       sk=createdAt  (newest-first history)
 *   ImageCacheIndex   — pk=imageCacheKey, sk=createdAt  (image reuse lookup)
 */
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ForecastResult } from '@uweather/core';
import { Resource } from 'sst';
import { ulid } from 'ulid';
import { dynamo } from './db-client.js';

export class ForecastService {
  /**
   * Fetch a complete forecast by ID.
   * Throws if the record does not exist.
   */
  async getById(forecastId: string): Promise<ForecastResult> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: Resource.Forecasts.name,
        Key: { pk: `FORECAST#${forecastId}`, sk: 'META' },
      }),
    );
    if (!result.Item) throw new Error(`Forecast not found: ${forecastId}`);
    return result.Item as ForecastResult;
  }

  /**
   * Persist a completed forecast.
   * Generates a ULID forecastId and ISO timestamp automatically.
   *
   * @returns The generated forecastId
   */
  async save(input: Omit<ForecastResult, 'forecastId' | 'createdAt'>): Promise<string> {
    const forecastId = ulid();
    const createdAt = new Date().toISOString();
    await dynamo.send(
      new PutCommand({
        TableName: Resource.Forecasts.name,
        Item: {
          pk: `FORECAST#${forecastId}`,
          sk: 'META',
          forecastId,
          createdAt,
          ...input,
        },
      }),
    );
    return forecastId;
  }

  /**
   * List a user's past forecasts, newest first.
   * Queries the UserHistoryIndex GSI.
   *
   * @param userId - Telegram chatId or web sessionId
   * @param limit  - Max results (1–50), defaults to 10
   */
  async listByUser(userId: string, limit = 10): Promise<ForecastResult[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: Resource.Forecasts.name,
        IndexName: 'UserHistoryIndex',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false, // newest first
        Limit: limit,
      }),
    );
    return (result.Items ?? []) as ForecastResult[];
  }

  /**
   * Look up an existing image URL by image cache key.
   * Queries the ImageCacheIndex GSI — returns the most recent match.
   *
   * @returns The CloudFront imageUrl, or null if no cached image exists
   */
  async findImageUrl(imageCacheKey: string): Promise<string | null> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: Resource.Forecasts.name,
        IndexName: 'ImageCacheIndex',
        KeyConditionExpression: 'imageCacheKey = :key',
        ExpressionAttributeValues: { ':key': imageCacheKey },
        ScanIndexForward: false, // newest first
        Limit: 1,
        ProjectionExpression: 'imageUrl',
      }),
    );
    const imageUrl = result.Items?.[0]?.imageUrl as string | undefined;
    return imageUrl ?? null;
  }

  /**
   * Fetch recent funny texts for a city+language combination.
   * Used by the funny-text agent to avoid generating repetitive content.
   *
   * Queries UserHistoryIndex via a synthetic `system#{city}` userId bucket.
   * Returns an empty array if the query fails (non-fatal — best-effort).
   *
   * @param city     - Normalized city name
   * @param language - ISO 639-1 language code
   * @param limit    - Max history items, defaults to 5
   */
  async listRecentFunnyTexts(city: string, language: string, limit = 5): Promise<string[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: Resource.Forecasts.name,
        IndexName: 'UserHistoryIndex',
        KeyConditionExpression: 'userId = :uid',
        FilterExpression: 'city = :city AND #lang = :lang',
        ExpressionAttributeNames: { '#lang': 'language' },
        ExpressionAttributeValues: {
          ':uid': `system#${city}`,
          ':city': city,
          ':lang': language,
        },
        ScanIndexForward: false, // newest first
        Limit: limit,
        ProjectionExpression: 'funnyText',
      }),
    );
    return (result.Items ?? []).map((item) => item.funnyText as string).filter(Boolean);
  }
}

export const forecastService = new ForecastService();

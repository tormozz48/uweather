/**
 * Orchestrator Lambda — entry point for the forecast pipeline.
 *
 * 1. Normalizes city name.
 * 2. Queries WeatherCache: if ≥2 providers have fresh data (< 30 min), returns
 *    a cache hit immediately without starting Step Functions.
 * 3. On cache miss: starts a Step Functions Standard Workflow execution and
 *    returns the execution ARN for status polling (used in Phase 4 by the API).
 *
 * Invoked directly in Phase 2 (for testing). In Phase 4, the GET /forecast
 * Lambda handler will call this function.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Resource } from 'sst';
import { createLogger, normalizeCity, toDateString, getCurrentTimeSlot } from '@uweather/core';
import type { UnifiedWeatherData, WeatherCacheEntry } from '@uweather/core';
import { randomUUID } from 'node:crypto';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sfn = new SFNClient({});
const log = createLogger({ function: 'orchestrator' });

const CACHE_FRESH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface OrchestratorInput {
  city: string;
  language?: string;
  /** Telegram chatId or web sessionId — defaults to 'anonymous' until Phase 4 */
  userId?: string;
}

export type OrchestratorOutput =
  | { cacheHit: true; providers: UnifiedWeatherData[] }
  | { cacheHit: false; executionArn: string };

export async function handler(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const city = input.city?.trim();
  if (!city) throw new Error('city is required');

  const language = input.language ?? 'en';
  const userId = input.userId ?? 'anonymous';
  const cityNormalized = normalizeCity(city);
  const date = toDateString();
  const timeSlot = getCurrentTimeSlot();

  log.info('Orchestrator invoked', { city: cityNormalized, language });

  // ── 1. Check WeatherCache ───────────────────────────────────────────────────
  const cacheResult = await dynamo.send(
    new QueryCommand({
      TableName: Resource.WeatherCache.name,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :datePrefix)',
      ExpressionAttributeValues: {
        ':pk': `CACHE#${cityNormalized}`,
        ':datePrefix': `${date}#`,
      },
    }),
  );

  const items = (cacheResult.Items ?? []) as WeatherCacheEntry[];
  const cutoffMs = Date.now() - CACHE_FRESH_WINDOW_MS;
  const freshItems = items.filter((item) => new Date(item.fetchedAt).getTime() > cutoffMs);

  if (freshItems.length >= 2) {
    log.info('Cache hit — skipping Step Functions', {
      city: cityNormalized,
      freshProviders: freshItems.length,
    });
    return {
      cacheHit: true,
      providers: freshItems.map((item) => item.data),
    };
  }

  // ── 2. Cache miss — start Step Functions execution ─────────────────────────
  log.info('Cache miss — starting Step Functions execution', {
    city: cityNormalized,
    staleItems: freshItems.length,
  });

  const stateMachineArn = process.env.STATE_MACHINE_ARN;
  if (!stateMachineArn) throw new Error('STATE_MACHINE_ARN environment variable is not set');

  // Execution name must be unique and match [a-zA-Z0-9_-]+, max 80 chars
  const executionName = `${cityNormalized.replace(/[^a-z0-9]/g, '-')}-${date}-${randomUUID().slice(0, 8)}`;

  const execution = await sfn.send(
    new StartExecutionCommand({
      stateMachineArn,
      name: executionName,
      input: JSON.stringify({ city: cityNormalized, language, date, userId, timeSlot }),
    }),
  );

  log.info('Step Functions execution started', {
    city: cityNormalized,
    executionArn: execution.executionArn,
    executionName,
  });

  return {
    cacheHit: false,
    executionArn: execution.executionArn!,
  };
}

import { randomUUID } from 'node:crypto';
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
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { createLogger, getCurrentTimeSlot, normalizeCity, toDateString } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';
import type { Context } from 'aws-lambda';
import { weatherCacheService } from './services/index.js';

const sfn = new SFNClient({});
const log = createLogger({ function: 'orchestrator' });

const CACHE_FRESH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface OrchestratorInput {
  city: string;
  language?: string;
  /** Web sessionId — defaults to 'anonymous' */
  userId?: string;
  /** Propagated from calling Lambda context for end-to-end correlation */
  correlationId?: string;
  /** Pre-resolved coordinates from the client's geocoding selection.
   *  Forwarded to provider Lambdas so they skip their own geocoding. */
  lat?: number;
  lon?: number;
}

export type OrchestratorOutput =
  | { cacheHit: true; providers: UnifiedWeatherData[] }
  | { cacheHit: false; executionArn: string };

export async function handler(
  input: OrchestratorInput,
  context?: Context,
): Promise<OrchestratorOutput> {
  const city = input.city?.trim();
  if (!city) throw new Error('city is required');

  const language = input.language ?? 'en';
  const userId = input.userId ?? 'anonymous';
  const cityNormalized = normalizeCity(city);
  const date = toDateString();
  const timeSlot = getCurrentTimeSlot();
  const coords =
    input.lat !== undefined && input.lon !== undefined
      ? { lat: input.lat, lon: input.lon }
      : undefined;

  // Support both Lambda context requestId and explicit correlationId from callers
  const requestId = context?.awsRequestId ?? input.correlationId;
  const reqLog = log.child({ requestId, city: cityNormalized, language });

  reqLog.info('Orchestrator invoked', { userId });

  // ── 1. Check WeatherCache ───────────────────────────────────────────────────
  const items = await weatherCacheService.load(cityNormalized, date);
  const cutoffMs = Date.now() - CACHE_FRESH_WINDOW_MS;
  const freshItems = items.filter((item) => new Date(item.fetchedAt).getTime() > cutoffMs);

  if (freshItems.length >= 2) {
    reqLog.info('Cache hit — skipping Step Functions', {
      freshProviders: freshItems.length,
    });
    return {
      cacheHit: true,
      providers: freshItems.map((item) => item.data),
    };
  }

  // ── 2. Cache miss — start Step Functions execution ─────────────────────────
  reqLog.info('Cache miss — starting Step Functions execution', {
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
      input: JSON.stringify({ city: cityNormalized, language, date, userId, timeSlot, ...coords }),
    }),
  );

  reqLog.info('Step Functions execution started', {
    executionArn: execution.executionArn,
    executionName,
  });

  return {
    cacheHit: false,
    executionArn: execution.executionArn ?? '',
  };
}

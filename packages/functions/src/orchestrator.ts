import { randomUUID } from 'node:crypto';
/**
 * Orchestrator Lambda — single entry point for starting the forecast pipeline.
 *
 * Normalises the city name, then unconditionally starts a Step Functions
 * Standard Workflow execution and returns the execution ARN.
 *
 * The state machine owns all cache checks internally (CheckCache → CacheDecision):
 * if ≥2 providers have fresh weather data it skips provider fetches and goes
 * straight to the AI agents; otherwise it fetches fresh data first. Duplicating
 * that cache check here would create a confusing dual-start path without saving
 * any SFN executions (AI agents always need to run regardless of weather cache).
 *
 * Callers poll GET /forecast/status?executionArn={arn} for pipeline progress.
 */
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { createLogger, getCurrentTimeSlot, normalizeCity, toDateString } from '@uweather/core';
import type { Context } from 'aws-lambda';

const sfn = new SFNClient({});
const log = createLogger({ function: 'orchestrator' });

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

export interface OrchestratorOutput {
  executionArn: string;
}

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

  return { executionArn: execution.executionArn ?? '' };
}

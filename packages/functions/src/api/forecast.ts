import { randomUUID } from 'node:crypto';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { createLogger, getCurrentTimeSlot, normalizeCity, toDateString } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { handler as orchestratorHandler } from '../orchestrator.js';
import { jsonAccepted, jsonBadRequest, jsonServerError } from './utils.js';

const sfn = new SFNClient({});
const log = createLogger({ function: 'api-forecast' });

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape returned to the client on a successful pipeline start (HTTP 202). */
export interface ForecastStartResponse {
  status: 'pending';
  executionArn: string;
  city: string;
  language: string;
}

// ── Pipeline helpers ──────────────────────────────────────────────────────────

/**
 * Start the forecast pipeline (or resume an already-started execution).
 *
 * The orchestrator checks the WeatherCache first:
 *  - Cache miss  → orchestrator already started Step Functions; return its ARN.
 *  - Cache hit   → weather data is fresh but Step Functions wasn't started;
 *                  start it here so the AI agents can run against the cached data.
 */
async function startPipeline(
  city: string,
  language: string,
  userId: string,
  correlationId: string,
): Promise<string> {
  const cityNormalized = normalizeCity(city);
  const date = toDateString();
  const timeSlot = getCurrentTimeSlot();

  const result = await orchestratorHandler({ city, language, userId, correlationId });

  if (!result.cacheHit) {
    return result.executionArn;
  }

  // Weather cache hit — orchestrator didn't start Step Functions; start it now.
  const stateMachineArn = process.env.STATE_MACHINE_ARN;
  if (!stateMachineArn) throw new Error('STATE_MACHINE_ARN not set');

  const executionName = `${cityNormalized.replace(/[^a-z0-9]/g, '-')}-${date}-${randomUUID().slice(0, 8)}`;
  const execution = await sfn.send(
    new StartExecutionCommand({
      stateMachineArn,
      name: executionName,
      input: JSON.stringify({ city: cityNormalized, language, date, userId, timeSlot }),
    }),
  );
  const executionArn = execution.executionArn;
  if (!executionArn) throw new Error('Step Functions did not return an execution ARN');
  return executionArn;
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * GET /forecast?city={city}&lang={lang}&userId={userId}
 *
 * Starts the forecast pipeline and returns immediately — no polling.
 * The client must poll GET /forecast/status?executionArn={arn} until the
 * forecast is ready (HTTP 200) or has failed (HTTP 500).
 *
 * Query params:
 *   city     — required, non-empty
 *   lang     — optional, ISO 639-1, default "en"
 *   userId   — optional, caller-provided session ID; defaults to "anonymous"
 *
 * Response 202 — ForecastStartResponse:
 *   { status: "pending", executionArn: string, city: string, language: string }
 *
 * The pipeline takes 15–30 s end-to-end (Bedrock + provider fetches).
 * Poll /forecast/status every 3–5 s until you receive HTTP 200 or 500.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const requestId = context.awsRequestId;
  const reqLog = log.child({ requestId });

  const params = event.queryStringParameters ?? {};
  const city = params.city?.trim();
  const language = params.lang?.trim() ?? 'en';
  const userId = params.userId?.trim() ?? 'anonymous';

  if (!city) {
    return jsonBadRequest('city query parameter is required');
  }

  reqLog.info('Forecast start request', { city, language, userId });

  try {
    const executionArn = await startPipeline(city, language, userId, requestId);

    reqLog.info('Pipeline started', { executionArn, city, language });

    return jsonAccepted<ForecastStartResponse>({
      status: 'pending',
      executionArn,
      city: normalizeCity(city),
      language,
    });
  } catch (err) {
    reqLog.error('Forecast start error', { city, error: (err as Error).message });
    return jsonServerError(500, 'Failed to start forecast pipeline', (err as Error).message);
  }
};

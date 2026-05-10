import { randomUUID } from 'node:crypto';
import { DescribeExecutionCommand, SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { createLogger, getCurrentTimeSlot, normalizeCity, toDateString } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { handler as orchestratorHandler } from '../orchestrator.js';
import {
  fetchForecastById,
  jsonBadRequest,
  jsonOk,
  jsonServerError,
  toForecastResponse,
} from './utils.js';

const sfn = new SFNClient({});
const log = createLogger({ function: 'api-forecast' });

// ── Types ─────────────────────────────────────────────────────────────────────

/** Output shape returned by the SaveForecast Step Functions task. */
interface PipelineOutput {
  forecastId: string;
  imageUrl: string;
  city: string;
  date: string;
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
async function startPipeline(city: string, language: string, userId: string): Promise<string> {
  const cityNormalized = normalizeCity(city);
  const date = toDateString();
  const timeSlot = getCurrentTimeSlot();

  const result = await orchestratorHandler({ city, language, userId });

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

/**
 * Poll a Step Functions execution until it succeeds, fails, or times out.
 * Resolves with the execution output (SaveForecastOutput) on success.
 */
async function pollExecution(executionArn: string, timeoutMs = 85_000): Promise<PipelineOutput> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 3_000));

    const { status, output, cause } = await sfn.send(
      new DescribeExecutionCommand({ executionArn }),
    );

    if (status === 'SUCCEEDED') {
      return JSON.parse(output ?? '{}') as PipelineOutput;
    }
    if (status === 'FAILED' || status === 'TIMED_OUT' || status === 'ABORTED') {
      throw new Error(`Pipeline ${status.toLowerCase()}: ${cause ?? 'unknown error'}`);
    }
    // RUNNING → keep polling
  }

  throw new Error('Forecast pipeline timed out');
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * GET /forecast?city={city}&lang={lang}&userId={userId}
 *
 * Invokes the orchestrator, starts the Step Functions pipeline if needed, polls
 * until complete, then returns the full ForecastResponse JSON.
 *
 * Query params:
 *   city     — required, non-empty
 *   lang     — optional, ISO 639-1, default "en"
 *   userId   — optional, caller-provided session ID; defaults to "anonymous"
 *
 * Polling: the pipeline takes 15–30 s end-to-end (Bedrock + provider fetches).
 * The Lambda polls Step Functions with a 3-second interval up to an 85-second
 * hard timeout; API Gateway HTTP API has a 29-second integration timeout, so
 * the client may receive a 504 before Lambda finishes — the forecast is still
 * stored in DynamoDB and available via /history on the next request.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const params = event.queryStringParameters ?? {};
  const city = params.city?.trim();
  const language = params.lang?.trim() ?? 'en';
  const userId = params.userId?.trim() ?? 'anonymous';

  if (!city) {
    return jsonBadRequest('city query parameter is required');
  }

  log.info('Forecast request', { city, language, userId });

  try {
    const executionArn = await startPipeline(city, language, userId);
    const { forecastId } = await pollExecution(executionArn);
    const forecast = await fetchForecastById(forecastId);

    log.info('Forecast delivered', { forecastId: forecast.forecastId, city: forecast.city });

    return jsonOk(toForecastResponse(forecast));
  } catch (err) {
    log.error('Forecast error', { city, err });

    const isTimeout = err instanceof Error && err.message.includes('timed out');
    return jsonServerError(
      isTimeout ? 504 : 500,
      isTimeout ? 'Forecast is taking longer than expected' : 'Failed to generate forecast',
      err instanceof Error ? err.message : String(err),
    );
  }
};

import { createLogger, normalizeCity } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { handler as orchestratorHandler } from '../orchestrator.js';
import { jsonAccepted, jsonBadRequest, jsonServerError } from './utils.js';

const log = createLogger({ function: 'api-forecast' });

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape returned to the client on a successful pipeline start (HTTP 202). */
export interface ForecastStartResponse {
  status: 'pending';
  executionArn: string;
  city: string;
  language: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * GET /forecast?city={city}&lang={lang}&userId={userId}
 *
 * Delegates to the orchestrator, which normalises the city and starts a Step
 * Functions execution. Returns HTTP 202 immediately — no polling here.
 * The state machine handles the weather-cache check internally (CheckCache →
 * CacheDecision) and runs AI agents regardless of cache state.
 *
 * Query params:
 *   city     — required, non-empty
 *   lang     — optional, ISO 639-1, default "en"
 *   userId   — optional, caller-provided session ID; defaults to "anonymous"
 *   lat/lon  — optional, pre-resolved coordinates from client geocoding
 *
 * Response 202 — ForecastStartResponse:
 *   { status: "pending", executionArn: string, city: string, language: string }
 *
 * The pipeline takes 15–30 s end-to-end. Poll /forecast/status every 3–5 s
 * until you receive HTTP 200 (success) or 500 (failure).
 */
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const requestId = context.awsRequestId;
  const reqLog = log.child({ requestId });

  const params = event.queryStringParameters ?? {};
  const city = params.city?.trim();
  const language = params.lang?.trim() ?? 'en';
  const userId = params.userId?.trim() ?? 'anonymous';
  const latRaw = params.lat ? Number(params.lat) : undefined;
  const lonRaw = params.lon ? Number(params.lon) : undefined;
  const coords =
    latRaw !== undefined && lonRaw !== undefined && !Number.isNaN(latRaw) && !Number.isNaN(lonRaw)
      ? { lat: latRaw, lon: lonRaw }
      : undefined;

  if (!city) {
    return jsonBadRequest('city query parameter is required');
  }

  reqLog.info('Forecast start request', { city, language, userId, coords });

  try {
    const { executionArn } = await orchestratorHandler({
      city,
      language,
      userId,
      correlationId: requestId,
      ...coords,
    });

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

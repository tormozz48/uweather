/**
 * GET /history?userId={userId}&limit={limit}
 *
 * Returns the last N forecast records for a given userId, ordered newest-first.
 * Queries the UserHistoryIndex GSI on the Forecasts table.
 *
 * Query params:
 *   userId  — required
 *   limit   — optional, 1–50, default 10
 */
import { createLogger } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { forecastService } from '../services/index.js';
import { jsonBadRequest, jsonOk, jsonServerError, toForecastResponse } from './utils.js';

const log = createLogger({ function: 'api-history' });

/** Clamp and parse the `limit` query param: integer in [1, 50], default 10. */
function parseLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '10', 10);
  return Math.min(50, Math.max(1, Number.isNaN(parsed) ? 10 : parsed));
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const params = event.queryStringParameters ?? {};
  const userId = params.userId?.trim();

  if (!userId) {
    return jsonBadRequest('userId query parameter is required');
  }

  const limit = parseLimit(params.limit);

  log.info('History request', { userId, limit });

  try {
    const forecasts = (await forecastService.listByUser(userId, limit)).map(toForecastResponse);

    log.info('History delivered', { userId, count: forecasts.length });

    return jsonOk({ userId, forecasts });
  } catch (err) {
    log.error('History error', { userId, err });
    return jsonServerError(
      500,
      'Failed to fetch history',
      err instanceof Error ? err.message : String(err),
    );
  }
};

import { createLogger } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { forecastService } from '../services/index.js';
import { jsonBadRequest, jsonOk, jsonServerError, toForecastResponse } from './utils.js';

const log = createLogger({ function: 'api-history' });

const MIN_HISTORY_LIMIT = 1;
const MAX_HISTORY_LIMIT = 50;
const DEFAULT_HISTORY_LIMIT = 10;

/** Clamp and parse the `limit` query param: integer in [MIN, MAX], default DEFAULT. */
function parseLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? String(DEFAULT_HISTORY_LIMIT), 10);
  return Math.min(MAX_HISTORY_LIMIT, Math.max(MIN_HISTORY_LIMIT, Number.isNaN(parsed) ? DEFAULT_HISTORY_LIMIT : parsed));
}

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
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const reqLog = log.child({ requestId: context.awsRequestId });
  const params = event.queryStringParameters ?? {};
  const userId = params.userId?.trim();

  if (!userId) {
    return jsonBadRequest('userId query parameter is required');
  }

  const limit = parseLimit(params.limit);

  reqLog.info('History request', { userId, limit });

  try {
    const forecasts = (await forecastService.listByUser(userId, limit)).map(toForecastResponse);

    reqLog.info('History delivered', { userId, count: forecasts.length });

    return jsonOk({ userId, forecasts });
  } catch (err) {
    reqLog.error('History error', { userId, error: (err as Error).message });
    return jsonServerError(
      500,
      'Failed to fetch history',
      err instanceof Error ? err.message : String(err),
    );
  }
};

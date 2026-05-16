import { createLogger } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { fetchForecastById, jsonBadRequest, jsonOk, jsonServerError, toForecastResponse } from './utils.js';

const log = createLogger({ function: 'api-forecast-by-id' });

const FORECAST_NOT_FOUND_STATUS = 404;

/**
 * GET /forecast/{forecastId}
 *
 * Returns a single forecast by its ULID.
 * Used for shareable direct links — no authentication required.
 *
 * Path params:
 *   forecastId — ULID of the forecast
 */
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const reqLog = log.child({ requestId: context.awsRequestId });
  const forecastId = event.pathParameters?.forecastId?.trim();

  if (!forecastId) {
    return jsonBadRequest('forecastId path parameter is required');
  }

  reqLog.info('Forecast lookup', { forecastId });

  try {
    const forecast = await fetchForecastById(forecastId);
    reqLog.info('Forecast found', { forecastId, city: forecast.city });
    return jsonOk(toForecastResponse(forecast));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('not found')) {
      reqLog.warn('Forecast not found', { forecastId });
      return {
        statusCode: FORECAST_NOT_FOUND_STATUS,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forecast not found' }),
      };
    }

    reqLog.error('Forecast lookup error', { forecastId, error: message });
    return jsonServerError(500, 'Failed to fetch forecast', message);
  }
};

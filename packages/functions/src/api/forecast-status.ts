import { DescribeExecutionCommand, SFNClient } from '@aws-sdk/client-sfn';
import { createLogger } from '@uweather/core';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  fetchForecastById,
  jsonAccepted,
  jsonBadRequest,
  jsonOk,
  jsonServerError,
  toForecastResponse,
} from './utils.js';

const sfn = new SFNClient({});
const log = createLogger({ function: 'api-forecast-status' });

// ── Types ─────────────────────────────────────────────────────────────────────

/** Output shape saved by the SaveForecast Step Functions task. */
interface PipelineOutput {
  forecastId: string;
  imageUrl: string;
  city: string;
  date: string;
}

/** Shape returned while the pipeline is still running (HTTP 202). */
interface ForecastPendingResponse {
  status: 'pending';
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * GET /forecast/status?executionArn={arn}
 *
 * Check the status of a running forecast pipeline execution.
 * Each call maps to a single DescribeExecution API call — no long-polling.
 * The client owns the retry loop.
 *
 * Query params:
 *   executionArn — required, the ARN returned by GET /forecast
 *
 * Responses:
 *   202  { status: "pending" }     — pipeline still RUNNING; poll again shortly
 *   200  ForecastResponse          — pipeline SUCCEEDED; full forecast returned
 *   500  { error, message }        — pipeline FAILED / TIMED_OUT / ABORTED
 *   400  { error }                 — missing executionArn param
 *
 * Typical polling pattern: call every 3–5 s until you receive HTTP 200 or 500.
 * The pipeline completes in 15–30 s end-to-end.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const requestId = context.awsRequestId;
  const reqLog = log.child({ requestId });

  const params = event.queryStringParameters ?? {};
  const executionArn = params.executionArn?.trim();

  if (!executionArn) {
    return jsonBadRequest('executionArn query parameter is required');
  }

  reqLog.info('Forecast status check', { executionArn });

  try {
    const { status, output, cause } = await sfn.send(
      new DescribeExecutionCommand({ executionArn }),
    );

    reqLog.info('Execution status', { executionArn, status });

    if (status === 'RUNNING') {
      return jsonAccepted<ForecastPendingResponse>({ status: 'pending' });
    }

    if (status === 'SUCCEEDED') {
      const { forecastId } = JSON.parse(output ?? '{}') as PipelineOutput;
      const forecast = await fetchForecastById(forecastId);
      reqLog.info('Forecast ready', { forecastId: forecast.forecastId, city: forecast.city });
      return jsonOk(toForecastResponse(forecast));
    }

    // FAILED | TIMED_OUT | ABORTED
    const reason = cause ?? `Pipeline ${(status ?? 'unknown').toLowerCase()}`;
    reqLog.error('Pipeline terminal failure', { executionArn, status, cause });
    return jsonServerError(500, 'Forecast pipeline failed', reason);
  } catch (err) {
    reqLog.error('Status check error', { executionArn, error: (err as Error).message });
    return jsonServerError(500, 'Failed to check forecast status', (err as Error).message);
  }
};

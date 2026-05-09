/**
 * Forecast pipeline runner for the Telegram bot.
 *
 * Wraps orchestrator invocation, Step Functions polling, and DynamoDB reads
 * into two clean public functions:
 *  - runPipeline        — trigger the full AI pipeline and return the result
 *  - fetchForecastHistory — query the last N forecasts for a user
 */
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DescribeExecutionCommand, SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ForecastResult } from '@uweather/core';
import { createLogger, getCurrentTimeSlot, normalizeCity, toDateString } from '@uweather/core';
import { Resource } from 'sst';
import { handler as orchestratorHandler } from '../orchestrator.js';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sfn = new SFNClient({});
const log = createLogger({ function: 'telegram-pipeline' });

/** Output shape returned by the SaveForecast Step Functions task. */
interface PipelineOutput {
  forecastId: string;
  imageUrl: string;
  city: string;
  date: string;
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function pollExecution(executionArn: string, timeoutMs = 90_000): Promise<PipelineOutput> {
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

  throw new Error('Forecast timed out — please try again');
}

async function fetchForecastById(forecastId: string): Promise<ForecastResult> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: Resource.Forecasts.name,
      Key: { pk: `FORECAST#${forecastId}`, sk: 'META' },
    }),
  );
  if (!result.Item) throw new Error(`Forecast not found: ${forecastId}`);
  return result.Item as ForecastResult;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Trigger the full forecast pipeline and return the completed ForecastResult.
 *
 * Calls the orchestrator first:
 *  - Cache miss  → orchestrator already started Step Functions; use its ARN.
 *  - Cache hit   → weather data is fresh but Step Functions wasn't started;
 *                  start it here so the AI agents can run against cached data.
 */
export async function runPipeline(
  city: string,
  language: string,
  userId: string,
): Promise<ForecastResult> {
  const cityNormalized = normalizeCity(city);
  const date = toDateString();
  const timeSlot = getCurrentTimeSlot();

  const result = await orchestratorHandler({ city, language, userId });

  let executionArn: string;

  if (result.cacheHit) {
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
    const arn = execution.executionArn;
    if (!arn) throw new Error('Step Functions did not return an execution ARN');
    executionArn = arn;
  } else {
    executionArn = result.executionArn;
  }

  log.info('Pipeline started', { city: cityNormalized, executionArn });

  const pipelineOutput = await pollExecution(executionArn);
  return fetchForecastById(pipelineOutput.forecastId);
}

/**
 * Return the last `limit` forecasts for a Telegram user, newest-first.
 * Queries the UserHistoryIndex GSI on the Forecasts table.
 */
export async function fetchForecastHistory(
  userId: string,
  limit: number,
): Promise<ForecastResult[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: Resource.Forecasts.name,
      IndexName: 'UserHistoryIndex',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (result.Items ?? []) as ForecastResult[];
}

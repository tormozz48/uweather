/**
 * WebSocket $connect handler.
 *
 * When the client opens a WebSocket, it passes `executionArn` as a query param.
 * We store {executionArn, connectionId} in DynamoDB so the push Lambda can
 * look up which connections to notify for a given pipeline execution.
 */
import { createLogger } from '@uweather/core';
import type { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { connectionService } from '../services/connection.service.js';

const log = createLogger({ function: 'ws-connect' });

export async function handler(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  const executionArn = event.queryStringParameters?.executionArn;

  if (!executionArn) {
    log.warn('Missing executionArn on connect', { connectionId });
    return { statusCode: 400, body: 'executionArn query parameter required' };
  }

  log.info('WebSocket connected', { connectionId, executionArn });

  try {
    await connectionService.put(executionArn, connectionId);
    return { statusCode: 200, body: 'Connected' };
  } catch (err) {
    log.error('Failed to store connection', {
      connectionId,
      executionArn,
      error: (err as Error).message,
    });
    return { statusCode: 500, body: 'Internal error' };
  }
}

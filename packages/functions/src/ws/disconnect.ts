/**
 * WebSocket $disconnect handler.
 *
 * Cleans up the connection record from DynamoDB.
 * Since we don't know the executionArn at disconnect time (it's not in the
 * event), we do a best-effort cleanup. The TTL on the connections table
 * handles any missed cleanups.
 */
import { createLogger } from '@uweather/core';
import type { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';

const log = createLogger({ function: 'ws-disconnect' });

export function handler(
  event: APIGatewayProxyWebsocketEventV2,
): APIGatewayProxyResultV2 {
  const connectionId = event.requestContext.connectionId;
  log.info('WebSocket disconnected', { connectionId });

  // TTL handles cleanup — no need to scan for the executionArn.
  // Connection records expire in 10 minutes regardless.
  return { statusCode: 200, body: 'Disconnected' };
}

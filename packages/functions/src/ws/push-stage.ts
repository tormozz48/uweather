/**
 * WebSocket push Lambda — EventBridge target.
 *
 * Receives custom EventBridge events (source: uweather.pipeline,
 * detail-type: StageProgress) and pushes stage updates to all WebSocket
 * connections watching that executionArn.
 *
 * Also handles Step Functions execution status change events for
 * pipeline completion (SUCCEEDED / FAILED).
 */
import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { createLogger } from '@uweather/core';
import type { PipelineCompleteMessage, PipelineStageId, StageProgressMessage } from '@uweather/core';
import { connectionService } from '../services/connection.service.js';

const log = createLogger({ function: 'ws-push-stage' });

// Lazily initialised — the endpoint is set from env at cold start
let wsClient: ApiGatewayManagementApiClient;

function getWsClient(): ApiGatewayManagementApiClient {
  if (!wsClient) {
    const endpoint = process.env.WS_API_ENDPOINT;
    if (!endpoint) throw new Error('WS_API_ENDPOINT env var not set');
    wsClient = new ApiGatewayManagementApiClient({ endpoint });
  }
  return wsClient;
}

// ── EventBridge event shapes ─────────────────────────────────────────────────

interface StageProgressDetail {
  executionArn: string;
  stage: PipelineStageId;
  status: 'started' | 'done';
  timestamp: string;
}

interface ExecutionStatusDetail {
  executionArn: string;
  status: 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
}

interface EventBridgeEvent {
  source: string;
  'detail-type': string;
  detail: StageProgressDetail | ExecutionStatusDetail;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function handler(event: EventBridgeEvent): Promise<void> {
  const detailType = event['detail-type'];

  let executionArn: string;
  let message: StageProgressMessage | PipelineCompleteMessage;

  if (detailType === 'StageProgress') {
    // Custom event from pipeline Lambdas
    const detail = event.detail as StageProgressDetail;
    executionArn = detail.executionArn;
    message = {
      type: 'stage',
      stage: detail.stage,
      status: detail.status,
      timestamp: detail.timestamp,
    };
  } else if (detailType === 'Step Functions Execution Status Change') {
    // Built-in SFN execution event
    const detail = event.detail as ExecutionStatusDetail;
    executionArn = detail.executionArn;

    // Only forward terminal states
    if (!['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'].includes(detail.status)) return;

    message = {
      type: 'complete',
      status: detail.status === 'SUCCEEDED' ? 'succeeded' : 'failed',
      timestamp: new Date().toISOString(),
    };
  } else {
    log.warn('Unknown detail-type', { detailType });
    return;
  }

  // Look up WebSocket connections for this execution
  const connectionIds = await connectionService.getByExecution(executionArn);

  if (connectionIds.length === 0) {
    // No client is watching this execution (e.g., Telegram bot flow)
    return;
  }

  log.info('Pushing to connections', {
    executionArn,
    connections: connectionIds.length,
    message,
  });

  const payload = Buffer.from(JSON.stringify(message));
  const client = getWsClient();

  // Push to all connections in parallel; remove gone connections silently
  await Promise.allSettled(
    connectionIds.map(async (connectionId) => {
      try {
        await client.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: payload,
          }),
        );
      } catch (err) {
        if (err instanceof GoneException) {
          log.info('Stale connection removed', { connectionId });
          // Connection is gone — TTL will clean up DynamoDB record
        } else {
          log.warn('PostToConnection failed', {
            connectionId,
            error: (err as Error).message,
          });
        }
      }
    }),
  );
}

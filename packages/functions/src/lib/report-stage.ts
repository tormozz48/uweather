/**
 * Thin wrapper around EventBridge PutEvents for pipeline stage reporting.
 *
 * Each pipeline Lambda calls reportStage() at entry (status=started) and
 * optionally at exit (status=done). The event is picked up by an EventBridge
 * rule and forwarded to the WebSocket push Lambda.
 *
 * Fire-and-forget: errors are swallowed so progress reporting never blocks
 * the pipeline's core work.
 */
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { PipelineStageId } from '@uweather/core';
import { createLogger } from '@uweather/core';

const eb = new EventBridgeClient({});
const log = createLogger({ function: 'report-stage' });

const SOURCE = 'uweather.pipeline';
const DETAIL_TYPE = 'StageProgress';

export async function reportStage(
  executionArn: string,
  stage: PipelineStageId,
  status: 'started' | 'done' = 'started',
): Promise<void> {
  try {
    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: SOURCE,
            DetailType: DETAIL_TYPE,
            Detail: JSON.stringify({
              executionArn,
              stage,
              status,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      }),
    );
  } catch (err) {
    // Fire-and-forget — never let progress reporting break the pipeline
    log.warn('Failed to report stage', {
      executionArn,
      stage,
      status,
      error: (err as Error).message,
    });
  }
}

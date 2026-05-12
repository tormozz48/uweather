/**
 * Shared Bedrock text invocation helper.
 *
 * Centralises the InvokeModelCommand call, latency timing, throttle detection,
 * and metric emission so agent Lambdas don't duplicate ~80 lines each.
 *
 * Usage:
 *   const text = await callBedrock({ system, user, agent: 'compare', log: reqLog });
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { createLogger, emitMetric } from '@uweather/core';

/** Inference profile ID for Claude Haiku 4.5 (required for on-demand throughput). */
export const HAIKU_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

/** Default max output tokens for Bedrock text generation calls. */
const DEFAULT_BEDROCK_MAX_TOKENS = 1024;

const bedrock = new BedrockRuntimeClient({});

export interface CallBedrockOptions {
  system: string;
  user: string;
  /** Dimension value used for BedrockLatency and BedrockThrottled metrics (e.g. 'compare'). */
  agent: string;
  maxTokens?: number; // defaults to DEFAULT_BEDROCK_MAX_TOKENS
  /** Child logger from the calling Lambda — keeps requestId/city context in log lines. */
  log: ReturnType<ReturnType<typeof createLogger>['child']>;
}

/**
 * Invoke Bedrock Claude Haiku and return the raw text response.
 *
 * - Emits BedrockLatency (Milliseconds) and, on throttle, BedrockThrottled (Count).
 * - Logs throttling as WARN; other errors as ERROR.
 * - Throws on all errors — callers handle retry policy via Step Functions.
 */
export async function callBedrock({
  system,
  user,
  agent,
  maxTokens = DEFAULT_BEDROCK_MAX_TOKENS,
  log,
}: CallBedrockOptions): Promise<string> {
  const bedrockStart = Date.now();
  let bedrockDurationMs = 0;

  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: HAIKU_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      }),
    );

    bedrockDurationMs = Date.now() - bedrockStart;
    emitMetric('BedrockLatency', bedrockDurationMs, 'Milliseconds', { agent });
    log.info(`Bedrock Haiku - ${agent}`, { duration_ms: bedrockDurationMs });

    const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as {
      content: Array<{ type: string; text: string }>;
    };
    return responseBody.content.find((c) => c.type === 'text')?.text ?? '';
  } catch (err) {
    bedrockDurationMs = Date.now() - bedrockStart;
    const isThrottle =
      err instanceof Error &&
      (err.name === 'ThrottlingException' || err.message.includes('throttl'));
    if (isThrottle) {
      log.warn(`Bedrock throttled on ${agent} agent`, {
        duration_ms: bedrockDurationMs,
        error: (err as Error).message,
      });
      emitMetric('BedrockThrottled', 1, 'Count', { agent });
    } else {
      log.error(`Bedrock invocation failed on ${agent} agent`, {
        duration_ms: bedrockDurationMs,
        error: (err as Error).message,
      });
    }
    throw err;
  }
}

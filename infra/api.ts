/**
 * infra/api.ts — Phase 4: API Gateway routes + Lambda bindings
 *
 * Routes:
 *   GET  /health              — liveness check
 *   GET  /forecast            — get AI forecast (polls Step Functions)
 *   GET  /history             — get user forecast history
 *   POST /telegram/webhook    — Telegram bot webhook
 *
 * Import order requirement: pipeline.ts must be imported before this file
 * because api.ts depends on forecastPipeline and telegramBotToken.
 */
import {
  weatherCacheTable,
  forecastsTable,
  usersTable,
} from './storage';
import {
  forecastPipeline,
  telegramBotToken,
} from './pipeline';

/**
 * API Gateway HTTP API.
 * All routes share CORS defaults (allowOrigins: ["*"]) for MVP.
 */
export const api = new sst.aws.ApiGatewayV2('Api', {
  cors: {
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type'],
    allowOrigins: ['*'],
  },
});

// ── Shared Step Functions permissions ─────────────────────────────────────────
//
// StartExecution targets the state machine ARN.
// DescribeExecution targets execution ARNs (different ARN namespace: "execution"
// vs "stateMachine"), so we use a wildcard for that action.

const sfnPermissions = [
  {
    actions: ['states:StartExecution'],
    resources: [forecastPipeline.arn],
  },
  {
    // Execution ARN format: arn:aws:states:{region}:{account}:execution:{name}:{execId}
    // Cannot derive it from the state machine ARN directly — use wildcard.
    actions: ['states:DescribeExecution'],
    resources: ['*' as const],
  },
];

// ── GET /health ───────────────────────────────────────────────────────────────

api.route('GET /health', {
  handler: 'packages/functions/src/api/health.handler',
});

// ── GET /forecast ─────────────────────────────────────────────────────────────
//
// Calls the orchestrator inline (bundled), starts Step Functions if needed,
// polls until complete (≤85 s), returns ForecastResponse JSON.
// Lambda timeout 120 s > API Gateway 29 s — client gets a 504 at GW timeout,
// but the Lambda continues; the result is stored in DynamoDB on success.
// For MVP this polling-in-Lambda approach is acceptable.

api.route('GET /forecast', {
  handler: 'packages/functions/src/api/forecast.handler',
  link: [weatherCacheTable, forecastsTable],
  environment: {
    STATE_MACHINE_ARN: forecastPipeline.arn,
  },
  permissions: sfnPermissions,
  timeout: '120 seconds',
  memory: '256 MB',
});

// ── GET /history ──────────────────────────────────────────────────────────────

api.route('GET /history', {
  handler: 'packages/functions/src/api/history.handler',
  link: [forecastsTable],
  timeout: '15 seconds',
  memory: '256 MB',
});

// ── POST /telegram/webhook ────────────────────────────────────────────────────
//
// grammY aws-lambda-async mode: API Gateway gets 200 immediately; the bot
// handler runs asynchronously inside the Lambda process.
// The handler calls the orchestrator inline (bundled) and polls Step Functions.

api.route('POST /telegram/webhook', {
  handler: 'packages/functions/src/telegram/webhook.handler',
  link: [usersTable, forecastsTable, weatherCacheTable, telegramBotToken],
  environment: {
    STATE_MACHINE_ARN: forecastPipeline.arn,
  },
  permissions: sfnPermissions,
  timeout: '120 seconds',
  memory: '512 MB',
});


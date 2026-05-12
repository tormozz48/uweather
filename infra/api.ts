import { forecastPipeline } from './pipeline.ts';
/**
 * infra/api.ts — Phase 4: API Gateway routes + Lambda bindings
 *                Phase 5 updates: X-Ray tracing on all route Lambdas
 *
 * Routes:
 *   GET  /health              — liveness check
 *   GET  /forecast            — start AI forecast pipeline, returns 202 + executionArn
 *   GET  /forecast/status     — poll pipeline status; returns 202 (pending) or 200 (done)
 *   GET  /history             — get user forecast history
 *
 * Import order requirement: pipeline.ts must be imported before this file
 * because api.ts depends on forecastPipeline.
 */
import { forecastsTable, weatherCacheTable } from './storage.ts';
import { xrayPermissions, xrayTransform } from './shared.ts';

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

// ── Step Functions permissions (split by action) ──────────────────────────────
//
// StartExecution targets the state machine ARN.
// DescribeExecution targets execution ARNs (different ARN namespace: "execution"
// vs "stateMachine"), so we use a wildcard for that action.
// Each Lambda gets only the permission it actually needs.

const sfnStartPermissions = [
  {
    actions: ['states:StartExecution'],
    resources: [forecastPipeline.arn],
  },
];

const sfnDescribePermissions = [
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
  permissions: xrayPermissions,
  transform: xrayTransform,
});

// ── GET /forecast ─────────────────────────────────────────────────────────────
//
// Calls the orchestrator inline (bundled), starts Step Functions if needed,
// and returns immediately with HTTP 202 { status: "pending", executionArn }.
// No polling — the client drives the polling loop via GET /forecast/status.
// Lambda timeout kept low (15 s): only orchestrator check + SFN StartExecution.

api.route('GET /forecast', {
  handler: 'packages/functions/src/api/forecast.handler',
  link: [weatherCacheTable],
  environment: {
    STATE_MACHINE_ARN: forecastPipeline.arn,
  },
  permissions: [...sfnStartPermissions, ...xrayPermissions],
  timeout: '15 seconds',
  memory: '256 MB',
  transform: xrayTransform,
});

// ── GET /forecast/status ──────────────────────────────────────────────────────
//
// Single DescribeExecution call — no polling loop, no long-running Lambda.
// Returns 202 while RUNNING, 200 + ForecastResponse on SUCCEEDED,
// 500 on FAILED / TIMED_OUT / ABORTED.
// Client polls this endpoint every 3–5 s until it gets a terminal response.

api.route('GET /forecast/status', {
  handler: 'packages/functions/src/api/forecast-status.handler',
  link: [forecastsTable],
  permissions: [...sfnDescribePermissions, ...xrayPermissions],
  timeout: '15 seconds',
  memory: '256 MB',
  transform: xrayTransform,
});

// ── GET /history ──────────────────────────────────────────────────────────────

api.route('GET /history', {
  handler: 'packages/functions/src/api/history.handler',
  link: [forecastsTable],
  timeout: '15 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

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

// ── Shared X-Ray config ───────────────────────────────────────────────────────
//
// All route Lambdas get active X-Ray tracing so traces propagate from API
// Gateway through Lambda into Step Functions (enabled on SFN in pipeline.ts).

const xrayTransform: sst.aws.FunctionArgs['transform'] = {
  function: (args) => {
    args.tracingConfig = { mode: 'Active' };
  },
};

const xrayPermissions = [
  {
    actions: [
      'xray:PutTraceSegments',
      'xray:PutTelemetryRecords',
      'xray:GetSamplingRules',
      'xray:GetSamplingTargets',
    ],
    resources: ['*' as const],
  },
];

// ── CORS allowed origins ──────────────────────────────────────────────────────
//
// dev: allow all origins (needed for `sst dev` and local Vite server).
// prod: restrict to the web SPA CloudFront domain to prevent unauthorized API
//       consumers from running up Bedrock/Pixazo costs.
//
// Because api.ts is imported before web.ts (web needs api.url for its build),
// the CloudFront URL cannot be derived automatically at deploy time.
//
// Workflow for prod:
//   1. Run `pnpm sst deploy --stage prod` once — note the Web URL in outputs.
//   2. On subsequent deploys, export the URL:
//        WEB_ORIGIN=https://dXXXX.cloudfront.net pnpm deploy-prod
//      or set it in your CI/CD environment.
//
// If WEB_ORIGIN is unset in prod, CORS falls back to '*' with a warning.

const allowedOrigins = (() => {
  if ($app.stage !== 'prod') return ['*'];
  const origin = process.env.WEB_ORIGIN?.trim();
  if (!origin) {
    console.warn(
      '[api] WEB_ORIGIN is not set for the prod stage — CORS allowOrigins is open (*).' +
        ' Set WEB_ORIGIN to the web SPA CloudFront URL to restrict access.',
    );
    return ['*'];
  }
  return [origin];
})();

/**
 * API Gateway HTTP API.
 */
export const api = new sst.aws.ApiGatewayV2('Api', {
  cors: {
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type'],
    allowOrigins: allowedOrigins,
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

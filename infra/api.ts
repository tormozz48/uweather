import { forecastPipeline } from './pipeline.ts';
/**
 * infra/api.ts — Phase 4: API Gateway routes + Lambda bindings
 *                Phase 5 updates: X-Ray tracing on all route Lambdas
 *
 * Routes:
 *   GET  /health                    — liveness check
 *   GET  /forecast                  — start AI forecast pipeline, returns 202 + executionArn
 *   GET  /forecast/status           — poll pipeline status; returns 202 (pending) or 200 (done)
 *   GET  /forecast/{forecastId}     — fetch a single forecast by ULID (shareable links)
 *   GET  /og/forecast/{forecastId}  — OG meta tags HTML for social sharing previews
 *   GET  /history                   — get user forecast history
 *
 * Import order requirement: pipeline.ts must be imported before this file
 * because api.ts depends on forecastPipeline.
 */
import { forecastsTable } from './storage.ts';

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
// prod: restrict to the custom web domain to prevent unauthorized API consumers
//       from running up Bedrock/Pixazo costs.
//
// Both stages use a fixed, known domain (uweather.eu / dev.uweather.eu), so
// there is no chicken-and-egg problem with deriving the origin at deploy time.

const PROD_WEB_ORIGIN = 'https://uweather.eu';

const allowedOrigins = $app.stage === 'prod' ? [PROD_WEB_ORIGIN] : ['*'];

/**
 * API Gateway HTTP API.
 *
 * Custom domain: api.uweather.eu (prod) / api.dev.uweather.eu (dev).
 * SST resolves the Route 53 hosted zone for uweather.eu and provisions an
 * ACM certificate + DNS record automatically on every deploy.
 */
export const api = new sst.aws.ApiGatewayV2('Api', {
  domain: {
    name: $app.stage === 'prod' ? 'api.uweather.eu' : 'api.dev.uweather.eu',
    dns: sst.aws.dns(),
  },
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
// Delegates to the orchestrator, which starts a Step Functions execution and
// returns immediately with HTTP 202 { status: "pending", executionArn }.
// No polling — the client drives the polling loop via GET /forecast/status.
// Lambda timeout kept low (15 s): only city normalisation + SFN StartExecution.
// WeatherCache is no longer checked here — the state machine owns that check.

api.route('GET /forecast', {
  handler: 'packages/functions/src/api/forecast.handler',
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

// ── GET /forecast/{forecastId} ────────────────────────────────────────────────
//
// Returns a single forecast by ULID. Powers shareable direct links —
// no authentication required (the app is anonymous).

api.route('GET /forecast/{forecastId}', {
  handler: 'packages/functions/src/api/forecast-by-id.handler',
  link: [forecastsTable],
  timeout: '15 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

// ── GET /og/forecast/{forecastId} ─────────────────────────────────────────────
//
// Returns a minimal HTML page with Open Graph meta tags for social sharing
// previews. Bot user agents (Telegram, Slack, Twitter, etc.) are redirected
// here by the CloudFront Function on the StaticSite.

api.route('GET /og/forecast/{forecastId}', {
  handler: 'packages/functions/src/api/og-forecast.handler',
  link: [forecastsTable],
  timeout: '15 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
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

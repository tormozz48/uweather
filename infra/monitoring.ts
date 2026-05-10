/**
 * infra/monitoring.ts — Phase 5: Observability + Hardening
 *
 * Resources:
 *   - SNS topic + email subscription for alarm notifications
 *   - CloudWatch Dashboard: 7 panels covering cache, providers, AI, SFN, API
 *   - CloudWatch Alarms (4):
 *       1. Step Functions execution failures
 *       2. Weather provider errors (high rate)
 *       3. Orchestrator Lambda P99 duration
 *       4. Bedrock throttling events
 *
 * Custom metrics are emitted via EMF (Embedded Metrics Format) directly from
 * Lambda stdout — no PutMetricData API calls needed. The namespace is
 * `uweather/{stage}` (set at runtime via SST_STAGE env var).
 *
 * Metric inventory (emitted by Lambda handlers):
 *   WeatherCacheHit / WeatherCacheMiss    — check-cache.ts
 *   ImageCacheHit / ImageCacheMiss        — check-image-cache.ts
 *   ProviderSuccess / ProviderError       — providers/*.ts  (dim: provider)
 *   BedrockLatency                        — compare.ts, funny-text.ts  (dim: agent)
 *   BedrockThrottled                      — compare.ts, funny-text.ts  (dim: agent)
 *   ImageGenerationCount                  — image-gen.ts
 *   ProviderCount                         — compare.ts
 *   LowConfidenceForecast                 — compare.ts (only 1 provider available)
 */
import { api } from './api.ts';
import { forecastPipeline, orchestratorFunction } from './pipeline.ts';

// ── SNS alarm topic ───────────────────────────────────────────────────────────
//
// Change ALARM_EMAIL to your preferred destination.
// In prod, replace with a PagerDuty/OpsGenie HTTPS endpoint or routing policy.

const ALARM_EMAIL = 'andrii@numica.com';

export const alarmTopic = new aws.sns.Topic('AlarmTopic', {
  name: $interpolate`uweather-alarms-${$app.stage}`,
});

new aws.sns.TopicSubscription('AlarmEmailSubscription', {
  topic: alarmTopic.arn,
  protocol: 'email',
  endpoint: ALARM_EMAIL,
});

// ── CloudWatch Dashboard ──────────────────────────────────────────────────────
//
// 7 widgets arranged in a 3-column (8 units each) grid, two rows of 3 + one
// full-width row at the bottom.
//
// Widget positions (x, y) and sizes (w, h) are in CloudWatch grid units
// (total width = 24).

const currentRegion = aws.getRegionOutput().name;

const dashboardBody = $resolve([
  forecastPipeline.arn,
  api.nodes.api.id,
  $app.stage,
  currentRegion,
]).apply(([sfnArn, apiId, stage, region]) => {
  const ns = `uweather/${stage}`;

  // Helper: build a standard metric widget
  const mkWidget = (x: number, y: number, width: number, properties: Record<string, unknown>) => ({
    type: 'metric',
    x,
    y,
    width,
    height: 6,
    properties,
  });

  // Helper: standard widget properties with sensible defaults
  const mkProps = (
    title: string,
    metrics: unknown[][],
    overrides: Record<string, unknown> = {},
  ) => ({
    title,
    view: 'timeSeries',
    stat: 'Sum',
    period: 300,
    region,
    metrics,
    ...overrides,
  });

  // Helper: custom namespace metric with service=uweather dimension
  const m = (metricName: string, ...rest: unknown[]) =>
    [ns, metricName, 'service', 'uweather', ...rest];

  const widgets = [
    // ── Row 1 ──────────────────────────────────────────────────────────────

    // Widget 1: Step Functions — executions succeeded vs failed
    mkWidget(
      0,
      0,
      8,
      mkProps('Step Functions Executions', [
        ['AWS/States', 'ExecutionsSucceeded', 'StateMachineArn', sfnArn, { label: 'Succeeded', color: '#2ca02c' }],
        ['AWS/States', 'ExecutionsFailed', 'StateMachineArn', sfnArn, { label: 'Failed', color: '#d62728' }],
        ['AWS/States', 'ExecutionThrottled', 'StateMachineArn', sfnArn, { label: 'Throttled', color: '#ff7f0e' }],
      ]),
    ),

    // Widget 2: Weather cache hit/miss (raw counts per 5 min)
    mkWidget(
      8,
      0,
      8,
      mkProps('Weather Cache — Hits vs Misses', [
        m('WeatherCacheHit', { label: 'Hit', color: '#2ca02c' }),
        m('WeatherCacheMiss', { label: 'Miss', color: '#ff7f0e' }),
      ]),
    ),

    // Widget 3: Image cache hit/miss
    mkWidget(
      16,
      0,
      8,
      mkProps('Image Cache — Hits vs Misses', [
        m('ImageCacheHit', { label: 'Hit', color: '#2ca02c' }),
        m('ImageCacheMiss', { label: 'Miss', color: '#ff7f0e' }),
        m('ImageGenerationCount', { label: 'Generated', color: '#9467bd' }),
      ]),
    ),

    // ── Row 2 ──────────────────────────────────────────────────────────────

    // Widget 4: Provider reliability — success vs error per provider
    mkWidget(
      0,
      6,
      8,
      mkProps('Weather Providers — Success vs Error', [
        m('ProviderSuccess', 'provider', 'openweather', { label: 'OpenWeather ✓' }),
        m('ProviderSuccess', 'provider', 'weatherapi', { label: 'WeatherAPI ✓' }),
        m('ProviderSuccess', 'provider', 'open-meteo', { label: 'Open-Meteo ✓' }),
        m('ProviderError', 'provider', 'openweather', { label: 'OpenWeather ✗', color: '#d62728' }),
        m('ProviderError', 'provider', 'weatherapi', { label: 'WeatherAPI ✗', color: '#e377c2' }),
        m('ProviderError', 'provider', 'open-meteo', { label: 'Open-Meteo ✗', color: '#bcbd22' }),
      ]),
    ),

    // Widget 5: Bedrock latency (P50, P95) for each agent
    // No widget-level stat — each metric defines its own percentile stat.
    mkWidget(
      8,
      6,
      8,
      mkProps(
        'Bedrock Agent Latency (ms)',
        [
          m('BedrockLatency', 'agent', 'compare', { label: 'Compare P50', stat: 'p50' }),
          m('BedrockLatency', 'agent', 'compare', { label: 'Compare P95', stat: 'p95' }),
          m('BedrockLatency', 'agent', 'funny-text', { label: 'FunnyText P50', stat: 'p50' }),
          m('BedrockLatency', 'agent', 'funny-text', { label: 'FunnyText P95', stat: 'p95' }),
        ],
        { stat: undefined },
      ),
    ),

    // Widget 6: Bedrock throttling + low-confidence forecasts
    mkWidget(
      16,
      6,
      8,
      mkProps('Bedrock Throttling + Forecast Quality', [
        m('BedrockThrottled', 'agent', 'compare', { label: 'Throttled (compare)', color: '#d62728' }),
        m('BedrockThrottled', 'agent', 'funny-text', { label: 'Throttled (funny-text)', color: '#e377c2' }),
        m('LowConfidenceForecast', { label: 'Low-confidence (1 provider)', color: '#ff7f0e' }),
      ]),
    ),

    // ── Row 3 — full width ─────────────────────────────────────────────────

    // Widget 7: API Gateway 4xx/5xx error counts
    mkWidget(
      0,
      12,
      24,
      mkProps(
        'API Gateway — Request Errors',
        [
          ['AWS/ApiGateway', '4XXError', 'ApiId', apiId, { label: '4xx Client Errors', color: '#ff7f0e' }],
          ['AWS/ApiGateway', '5XXError', 'ApiId', apiId, { label: '5xx Server Errors', color: '#d62728' }],
          ['AWS/ApiGateway', 'Count', 'ApiId', apiId, { label: 'Total Requests', yAxis: 'right' }],
        ],
        {
          period: 60,
          yAxis: { right: { label: 'Total Requests', showUnits: false } },
        },
      ),
    ),
  ];

  return JSON.stringify({ widgets });
});

new aws.cloudwatch.Dashboard('Dashboard', {
  dashboardName: $interpolate`uweather-${$app.stage}`,
  dashboardBody,
});

// ── CloudWatch Alarms ─────────────────────────────────────────────────────────

const metricNamespace = $interpolate`uweather/${$app.stage}`;

// Shared alarm configuration — override per-alarm as needed
const baseAlarmProps = {
  period: 300,
  evaluationPeriods: 1,
  comparisonOperator: 'GreaterThanOrEqualToThreshold',
  statistic: 'Sum',
  treatMissingData: 'notBreaching',
  alarmActions: [alarmTopic.arn],
  okActions: [alarmTopic.arn],
};

// Alarm 1: Step Functions execution failures
// Any pipeline failure within a 5-minute window is worth alerting.
new aws.cloudwatch.MetricAlarm('SfnFailureAlarm', {
  ...baseAlarmProps,
  alarmName: $interpolate`uweather-${$app.stage}-sfn-failures`,
  alarmDescription:
    'Forecast pipeline Step Functions execution failed. Check SFN logs and CloudWatch for root cause.',
  namespace: 'AWS/States',
  metricName: 'ExecutionsFailed',
  dimensions: { StateMachineArn: forecastPipeline.arn },
  threshold: 1,
});

// Alarm 2: Weather provider error rate — fire if >5 errors in 5 minutes
// (indicates an API key issue or provider outage; graceful degradation handles
// up to 1 failure per request, but persistent failures need attention)
new aws.cloudwatch.MetricAlarm('ProviderErrorAlarm', {
  ...baseAlarmProps,
  alarmName: $interpolate`uweather-${$app.stage}-provider-errors`,
  alarmDescription:
    'Multiple weather provider fetch failures. Check API keys and provider status pages.',
  namespace: metricNamespace,
  metricName: 'ProviderError',
  dimensions: { service: 'uweather' },
  threshold: 5,
});

// Alarm 3: Orchestrator Lambda P99 duration > 25 seconds
// The orchestrator should be quick (cache check + optional SFN start).
// High duration indicates DynamoDB latency or SFN API slowness.
new aws.cloudwatch.MetricAlarm('OrchestratorDurationAlarm', {
  ...baseAlarmProps,
  alarmName: $interpolate`uweather-${$app.stage}-orchestrator-duration`,
  alarmDescription:
    'Orchestrator Lambda P99 duration is unusually high. Possible DynamoDB or SFN API latency.',
  namespace: 'AWS/Lambda',
  metricName: 'Duration',
  dimensions: { FunctionName: orchestratorFunction.name },
  evaluationPeriods: 3,
  threshold: 25_000, // 25 seconds in milliseconds
  comparisonOperator: 'GreaterThanThreshold',
  statistic: undefined,
  extendedStatistic: 'p99',
});

// Alarm 4: Bedrock throttling — fire if >3 throttle events in 5 minutes
// Bedrock has on-demand quotas; sustained throttling means the inference
// profile quota needs to be increased.
new aws.cloudwatch.MetricAlarm('BedrockThrottleAlarm', {
  ...baseAlarmProps,
  alarmName: $interpolate`uweather-${$app.stage}-bedrock-throttled`,
  alarmDescription:
    'Bedrock ThrottlingException rate is high. Consider requesting a quota increase for the inference profile.',
  namespace: metricNamespace,
  metricName: 'BedrockThrottled',
  dimensions: { service: 'uweather' },
  threshold: 3,
});

// ── Exports ───────────────────────────────────────────────────────────────────

export { alarmTopic as alarmSnsTopic };

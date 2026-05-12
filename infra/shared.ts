/**
 * infra/shared.ts — Constants shared across infra stack files.
 *
 * Exported here to avoid copy-pasting identical definitions in pipeline.ts
 * and api.ts, and to keep the single source of truth obvious.
 */

// ── X-Ray Lambda transform ────────────────────────────────────────────────────
//
// Apply to every Lambda via `transform.function`. Sets tracingConfig to Active
// so the X-Ray daemon samples and records segments from each invocation, and
// traces propagate end-to-end from API Gateway through Step Functions.

export const xrayTransform: sst.aws.FunctionArgs['transform'] = {
  function: (args) => {
    args.tracingConfig = { mode: 'Active' };
  },
};

// ── X-Ray IAM permissions ─────────────────────────────────────────────────────
//
// Required for the Lambda execution role to send trace segments and telemetry
// to the X-Ray service. Must be attached to every traced Lambda.

export const xrayPermissions: sst.aws.FunctionArgs['permissions'] = [
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

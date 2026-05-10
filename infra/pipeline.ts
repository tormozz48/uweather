/**
 * infra/pipeline.ts — Phase 3: full AI agents pipeline
 *                     Phase 5 updates: X-Ray tracing, CloudWatch SFN logging
 *
 * Resources provisioned here:
 *  - SST Secrets: OpenWeatherApiKey, WeatherApiKey
 *  - Lambda functions:
 *      CheckCacheFn, OpenWeatherFn, WeatherApiFn, OpenMeteoFn   (Phase 2)
 *      Agent1CompareFn, Agent2FunnyTextFn, CheckImageCacheFn    (Phase 3)
 *      Agent3ImageGenFn, SaveForecastFn                         (Phase 3)
 *      OrchestratorFn                                           (Phase 2, updated)
 *  - IAM execution role for Step Functions
 *  - Step Functions Standard Workflow: ForecastPipeline
 *  - CloudWatch Log Group for SFN execution logs              (Phase 5)
 *
 * State machine flow (Phase 3, optimised):
 *
 *   CheckCache ──► CacheDecision
 *                    ├─(hit)──► NormalizeFromCache (Pass)
 *                    └─(miss)─► FetchWeather (Parallel) ──► NormalizeFromFetch (Pass)
 *                               Both paths ──►
 *   Agent1_Compare ──► ParallelAgents ─┬─► Branch A: Agent2_FunnyText
 *                                      └─► Branch B: CheckImageCache ──► ImageCacheDecision
 *                                                                          ├─(hit)──► NormalizeImageFromCache
 *                                                                          └─(miss)─► Agent3_ImageGen
 *                      ──► NormalizeParallelResults ──► SaveForecast ──► PipelineSuccess
 */
import { forecastsTable, imagesBucket, imagesCdn, weatherCacheTable } from './storage.ts';

// ── SST Secrets ───────────────────────────────────────────────────────────────

export const openWeatherApiKey = new sst.Secret('OpenWeatherApiKey');
export const weatherApiKey = new sst.Secret('WeatherApiKey');
export const telegramBotToken = new sst.Secret('TelegramBotToken');
export const pixazoApiKey = new sst.Secret('PixazoApiKey');

// ── CloudWatch Log Group for Step Functions ───────────────────────────────────
//
// SFN needs a log group to write execution-level events (ERROR level = state
// transitions that fail). Kept for 30 days to balance cost vs debuggability.

export const sfnLogGroup = new aws.cloudwatch.LogGroup('SfnLogGroup', {
  name: $interpolate`/aws/states/uweather-forecast-${$app.stage}`,
  retentionInDays: 30,
});

// ── Shared X-Ray transform ────────────────────────────────────────────────────
//
// Applied to every Lambda via `transform.function`. Sets tracingConfig to
// Active so the X-Ray daemon samples and records segments from each invocation.

const xrayTransform: sst.aws.FunctionArgs['transform'] = {
  function: (args) => {
    args.tracingConfig = { mode: 'Active' };
  },
};

// X-Ray IAM permissions — required for the Lambda execution role to send
// trace segments and telemetry to the X-Ray service.
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

// ── Phase 2 Lambda functions ──────────────────────────────────────────────────

const checkCacheFunction = new sst.aws.Function('CheckCacheFn', {
  handler: 'packages/functions/src/pipeline/check-cache.handler',
  link: [weatherCacheTable],
  timeout: '30 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

const openWeatherFunction = new sst.aws.Function('OpenWeatherFn', {
  handler: 'packages/functions/src/providers/openweather.handler',
  link: [weatherCacheTable, openWeatherApiKey],
  timeout: '90 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

const weatherApiFunction = new sst.aws.Function('WeatherApiFn', {
  handler: 'packages/functions/src/providers/weatherapi.handler',
  link: [weatherCacheTable, weatherApiKey],
  timeout: '90 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

const openMeteoFunction = new sst.aws.Function('OpenMeteoFn', {
  handler: 'packages/functions/src/providers/open-meteo.handler',
  link: [weatherCacheTable],
  timeout: '90 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

// ── Phase 3 Lambda functions ──────────────────────────────────────────────────

export const agent1CompareFunction = new sst.aws.Function('Agent1CompareFn', {
  handler: 'packages/functions/src/agents/compare.handler',
  timeout: '90 seconds',
  memory: '512 MB',
  // Bedrock access via IAM role — no resource link needed
  permissions: xrayPermissions,
  transform: xrayTransform,
});

export const agent2FunnyTextFunction = new sst.aws.Function('Agent2FunnyTextFn', {
  handler: 'packages/functions/src/agents/funny-text.handler',
  link: [forecastsTable],
  timeout: '90 seconds',
  memory: '512 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

const checkImageCacheFunction = new sst.aws.Function('CheckImageCacheFn', {
  handler: 'packages/functions/src/agents/check-image-cache.handler',
  link: [forecastsTable],
  timeout: '30 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

const agent3ImageGenFunction = new sst.aws.Function('Agent3ImageGenFn', {
  handler: 'packages/functions/src/agents/image-gen.handler',
  link: [imagesBucket, imagesCdn, pixazoApiKey],
  timeout: '90 seconds',
  memory: '512 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

const saveForecastFunction = new sst.aws.Function('SaveForecastFn', {
  handler: 'packages/functions/src/save-forecast.handler',
  link: [forecastsTable],
  timeout: '30 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

// ── Bedrock InvokeModel permissions ──────────────────────────────────────────
//
// Agent 1 + 2 use the Claude Haiku 4.5 *inference profile* (required for
// on-demand throughput — direct foundation-model IDs are not supported for
// this model).
//
// Inference profile ARN pattern:
//   arn:aws:bedrock:{region}::inference-profile/{profileId}
// Foundation model ARN must also be allowed (inference profile delegates to it):
//   arn:aws:bedrock:*::foundation-model/{modelId}
//
// Agent 3 (image generation) uses the Pixazo AI REST API — no Bedrock perms needed.

const bedrockRegion = aws.getRegionOutput().name;
const bedrockAccountId = aws.getCallerIdentityOutput().accountId;

const bedrockTextPolicy = $resolve([bedrockRegion, bedrockAccountId]).apply(([region, accountId]) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'bedrock:InvokeModel',
        Resource: [
          `arn:aws:bedrock:${region}:${accountId}:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0`,
          'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
        ],
      },
    ],
  }),
);

// Attach Bedrock text permission to Agent 1 and Agent 2
new aws.iam.RolePolicy('Agent1BedrockPolicy', {
  role: agent1CompareFunction.nodes.role.id,
  policy: bedrockTextPolicy,
});

new aws.iam.RolePolicy('Agent2BedrockPolicy', {
  role: agent2FunnyTextFunction.nodes.role.id,
  policy: bedrockTextPolicy,
});

// ── Step Functions IAM role ───────────────────────────────────────────────────

const sfRole = new aws.iam.Role('StepFunctionsRole', {
  name: $interpolate`uweather-sfn-${$app.stage}`,
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'states.amazonaws.com' },
        Action: 'sts:AssumeRole',
      },
    ],
  }),
});

// Allow Step Functions to invoke all task Lambdas
new aws.iam.RolePolicy('StepFunctionsInvokePolicy', {
  role: sfRole.id,
  policy: $jsonStringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'lambda:InvokeFunction',
        Resource: [
          checkCacheFunction.arn,
          openWeatherFunction.arn,
          weatherApiFunction.arn,
          openMeteoFunction.arn,
          agent1CompareFunction.arn,
          agent2FunnyTextFunction.arn,
          checkImageCacheFunction.arn,
          agent3ImageGenFunction.arn,
          saveForecastFunction.arn,
        ],
      },
    ],
  }),
});

// Allow Step Functions to send X-Ray trace segments (required when tracingConfiguration.enabled = true)
new aws.iam.RolePolicy('StepFunctionsXRayPolicy', {
  role: sfRole.id,
  policy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'xray:GetSamplingRules',
          'xray:GetSamplingTargets',
        ],
        Resource: '*',
      },
    ],
  }),
});

// Allow Step Functions to write execution logs to CloudWatch
new aws.iam.RolePolicy('StepFunctionsLogsPolicy', {
  role: sfRole.id,
  policy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'logs:CreateLogDelivery',
          'logs:GetLogDelivery',
          'logs:UpdateLogDelivery',
          'logs:DeleteLogDelivery',
          'logs:ListLogDeliveries',
          'logs:PutLogEvents',
          'logs:PutResourcePolicy',
          'logs:DescribeResourcePolicies',
          'logs:DescribeLogGroups',
        ],
        Resource: '*',
      },
    ],
  }),
});

// ── State machine helpers ─────────────────────────────────────────────────────

/**
 * Build a provider branch for the Parallel state.
 * Each branch retries twice on any error, then catches into a typed failure
 * Pass state so the Parallel always succeeds regardless of individual failures.
 */
function providerBranch(stateName: string, lambdaArn: string, providerName: string) {
  return {
    StartAt: stateName,
    States: {
      [stateName]: {
        Type: 'Task',
        Resource: lambdaArn,
        Retry: [
          {
            ErrorEquals: ['States.ALL'],
            MaxAttempts: 2,
            IntervalSeconds: 2,
            BackoffRate: 2.0,
            JitterStrategy: 'FULL',
          },
        ],
        Catch: [{ ErrorEquals: ['States.ALL'], Next: `${stateName}Error` }],
        End: true,
      },
      [`${stateName}Error`]: {
        Type: 'Pass',
        Result: { provider: providerName, success: false },
        End: true,
      },
    },
  };
}

/**
 * Bedrock retry config — retry 2× on throttling (429 / ThrottlingException),
 * but surface other errors immediately.
 */
const bedrockRetry = [
  {
    ErrorEquals: ['Bedrock.ThrottlingException', 'States.TaskFailed'],
    MaxAttempts: 2,
    IntervalSeconds: 5,
    BackoffRate: 2.0,
    JitterStrategy: 'FULL',
  },
];

/**
 * External HTTP API retry — retry 2× on any transient error with backoff.
 * Used for Agent3 (Pixazo SDXL) which calls an external REST API.
 */
const httpRetry = [
  {
    ErrorEquals: ['States.ALL'],
    MaxAttempts: 2,
    IntervalSeconds: 5,
    BackoffRate: 2.0,
    JitterStrategy: 'FULL',
  },
];

// ── State machine definition ──────────────────────────────────────────────────

const smDefinition = $resolve([
  checkCacheFunction.arn,
  openWeatherFunction.arn,
  weatherApiFunction.arn,
  openMeteoFunction.arn,
  agent1CompareFunction.arn,
  agent2FunnyTextFunction.arn,
  checkImageCacheFunction.arn,
  agent3ImageGenFunction.arn,
  saveForecastFunction.arn,
]).apply(
  ([
    checkCacheArn,
    openWeatherArn,
    weatherApiArn,
    openMeteoArn,
    agent1Arn,
    agent2Arn,
    checkImageCacheArn,
    agent3Arn,
    saveForecastArn,
  ]) =>
    JSON.stringify({
      Comment: 'uweather forecast pipeline — Phase 3: full AI agents pipeline',
      StartAt: 'CheckCache',
      TimeoutSeconds: 300,
      States: {
        // ── Cache check ─────────────────────────────────────────────────────
        CheckCache: {
          Type: 'Task',
          Resource: checkCacheArn,
          ResultPath: '$.cacheCheck',
          Retry: [{ ErrorEquals: ['States.ALL'], MaxAttempts: 1, IntervalSeconds: 1 }],
          Catch: [{ ErrorEquals: ['States.ALL'], ResultPath: null, Next: 'FetchWeather' }],
          Next: 'CacheDecision',
        },

        CacheDecision: {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.cacheCheck.cacheHit',
              BooleanEquals: true,
              Next: 'NormalizeFromCache',
            },
          ],
          Default: 'FetchWeather',
        },

        // Reshape cache-hit provider data into the same format Agent1 expects
        NormalizeFromCache: {
          Type: 'Pass',
          Parameters: {
            'city.$': '$.city',
            'language.$': '$.language',
            'date.$': '$.date',
            'userId.$': '$.userId',
            'timeSlot.$': '$.timeSlot',
            'providerResults.$': '$.cacheCheck.providers',
          },
          Next: 'Agent1_Compare',
        },

        // ── Parallel provider fetch ─────────────────────────────────────────
        FetchWeather: {
          Type: 'Parallel',
          Branches: [
            providerBranch('FetchOpenWeather', openWeatherArn, 'openweather'),
            providerBranch('FetchWeatherApi', weatherApiArn, 'weatherapi'),
            providerBranch('FetchOpenMeteo', openMeteoArn, 'open-meteo'),
          ],
          ResultPath: '$.fetchResults',
          Next: 'NormalizeFromFetch',
        },

        // Reshape fresh-fetch results into the same format Agent1 expects
        NormalizeFromFetch: {
          Type: 'Pass',
          Parameters: {
            'city.$': '$.city',
            'language.$': '$.language',
            'date.$': '$.date',
            'userId.$': '$.userId',
            'timeSlot.$': '$.timeSlot',
            'providerResults.$': '$.fetchResults',
          },
          Next: 'Agent1_Compare',
        },

        // ── Agent 1: Weather comparison ─────────────────────────────────────
        Agent1_Compare: {
          Type: 'Task',
          Resource: agent1Arn,
          Parameters: {
            'city.$': '$.city',
            'language.$': '$.language',
            'date.$': '$.date',
            'providerResults.$': '$.providerResults',
          },
          ResultPath: '$.agentCompare',
          Retry: bedrockRetry,
          Next: 'ParallelAgents',
        },

        // ── Parallel: Agent 2 (funny text) + image pipeline ────────────────
        //
        // Both branches consume only Agent1's consensus — no cross-dependency.
        // Branch A: generate funny localised text (Bedrock)
        // Branch B: check image cache → generate image on miss (Pixazo)
        ParallelAgents: {
          Type: 'Parallel',
          Branches: [
            // ── Branch A: Funny text ────────────────────────────────────────
            {
              StartAt: 'Agent2_FunnyText',
              States: {
                Agent2_FunnyText: {
                  Type: 'Task',
                  Resource: agent2Arn,
                  Parameters: {
                    'city.$': '$.city',
                    'language.$': '$.language',
                    'date.$': '$.date',
                    'consensus.$': '$.agentCompare.consensus',
                  },
                  Retry: bedrockRetry,
                  End: true,
                },
              },
            },
            // ── Branch B: Image pipeline ────────────────────────────────────
            {
              StartAt: 'CheckImageCache',
              States: {
                CheckImageCache: {
                  Type: 'Task',
                  Resource: checkImageCacheArn,
                  Parameters: {
                    'city.$': '$.city',
                    'date.$': '$.date',
                    'timeSlot.$': '$.timeSlot',
                    'consensus.$': '$.agentCompare.consensus',
                  },
                  ResultPath: '$.imageCache',
                  Retry: [{ ErrorEquals: ['States.ALL'], MaxAttempts: 1, IntervalSeconds: 1 }],
                  Next: 'ImageCacheDecision',
                },
                ImageCacheDecision: {
                  Type: 'Choice',
                  Choices: [
                    {
                      Variable: '$.imageCache.cacheHit',
                      BooleanEquals: true,
                      Next: 'NormalizeImageFromCache',
                    },
                  ],
                  Default: 'Agent3_ImageGen',
                },
                Agent3_ImageGen: {
                  Type: 'Task',
                  Resource: agent3Arn,
                  Parameters: {
                    'city.$': '$.city',
                    'date.$': '$.date',
                    'timeSlot.$': '$.timeSlot',
                    'consensus.$': '$.agentCompare.consensus',
                    'imageCacheKey.$': '$.imageCache.imageCacheKey',
                  },
                  Retry: httpRetry,
                  End: true,
                },
                // On cache hit, extract just imageUrl + imageCacheKey so the
                // branch output shape matches the Agent3_ImageGen output shape.
                NormalizeImageFromCache: {
                  Type: 'Pass',
                  Parameters: {
                    'imageUrl.$': '$.imageCache.imageUrl',
                    'imageCacheKey.$': '$.imageCache.imageCacheKey',
                  },
                  End: true,
                },
              },
            },
          ],
          ResultPath: '$.parallelResults',
          Next: 'NormalizeParallelResults',
        },

        // Merge parallel branch outputs into a flat shape for SaveForecast.
        // parallelResults[0] = { funnyText }  (Branch A)
        // parallelResults[1] = { imageUrl, imageCacheKey }  (Branch B)
        NormalizeParallelResults: {
          Type: 'Pass',
          Parameters: {
            'city.$': '$.city',
            'language.$': '$.language',
            'date.$': '$.date',
            'userId.$': '$.userId',
            'timeSlot.$': '$.timeSlot',
            'consensus.$': '$.agentCompare.consensus',
            'funnyText.$': '$.parallelResults[0].funnyText',
            'imageUrl.$': '$.parallelResults[1].imageUrl',
            'imageCacheKey.$': '$.parallelResults[1].imageCacheKey',
            'sourcesUsed.$': '$.agentCompare.sourcesUsed',
          },
          Next: 'SaveForecast',
        },

        // ── Persist forecast ────────────────────────────────────────────────
        SaveForecast: {
          Type: 'Task',
          Resource: saveForecastArn,
          Retry: [{ ErrorEquals: ['States.ALL'], MaxAttempts: 2, IntervalSeconds: 2 }],
          Next: 'PipelineSuccess',
        },

        PipelineSuccess: { Type: 'Succeed' },
      },
    }),
);

// ── Step Functions state machine ──────────────────────────────────────────────

export const forecastPipeline = new aws.sfn.StateMachine('ForecastPipeline', {
  name: $interpolate`uweather-forecast-${$app.stage}`,
  roleArn: sfRole.arn,
  definition: smDefinition,
  type: 'STANDARD',
  // Phase 5: Active X-Ray tracing — propagates traces from API GW through SFN into Lambda
  tracingConfiguration: { enabled: true },
  // SFN CloudWatch log delivery is configured separately via the AWS console or CLI
  // (the log group is provisioned above; connect it there to avoid Pulumi schema drift).
  loggingConfiguration: { level: 'OFF' },
});

// ── Orchestrator Lambda ───────────────────────────────────────────────────────

export const orchestratorFunction = new sst.aws.Function('OrchestratorFn', {
  handler: 'packages/functions/src/orchestrator.handler',
  link: [weatherCacheTable],
  environment: {
    STATE_MACHINE_ARN: forecastPipeline.arn,
  },
  permissions: [
    {
      actions: ['states:StartExecution'],
      resources: [forecastPipeline.arn],
    },
    ...xrayPermissions,
  ],
  timeout: '30 seconds',
  memory: '256 MB',
  transform: xrayTransform,
});

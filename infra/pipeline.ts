/**
 * infra/pipeline.ts — Phase 3: full AI agents pipeline
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
 *
 * State machine flow (Phase 3):
 *
 *   CheckCache ──► CacheDecision
 *                    ├─(hit)──► NormalizeFromCache (Pass)
 *                    └─(miss)─► FetchWeather (Parallel) ──► NormalizeFromFetch (Pass)
 *                               Both paths ──►
 *   Agent1_Compare ──► Agent2_FunnyText ──► CheckImageCache ──► ImageCacheDecision
 *                                                                  ├─(hit)──► PrepareSaveFromCache (Pass)
 *                                                                  └─(miss)─► Agent3_ImageGen ──► PrepareSaveFromGen (Pass)
 *                                                                  Both paths ──►
 *   SaveForecast ──► PipelineSuccess
 */
import {
  weatherCacheTable,
  forecastsTable,
  imagesBucket,
  imagesCdn,
} from './storage';

// ── SST Secrets ───────────────────────────────────────────────────────────────

export const openWeatherApiKey = new sst.Secret('OpenWeatherApiKey');
export const weatherApiKey = new sst.Secret('WeatherApiKey');

// ── Phase 2 Lambda functions ──────────────────────────────────────────────────

const checkCacheFunction = new sst.aws.Function('CheckCacheFn', {
  handler: 'packages/functions/src/pipeline/check-cache.handler',
  link: [weatherCacheTable],
  timeout: '30 seconds',
  memory: '256 MB',
});

const openWeatherFunction = new sst.aws.Function('OpenWeatherFn', {
  handler: 'packages/functions/src/providers/openweather.handler',
  link: [weatherCacheTable, openWeatherApiKey],
  timeout: '90 seconds',
  memory: '256 MB',
});

const weatherApiFunction = new sst.aws.Function('WeatherApiFn', {
  handler: 'packages/functions/src/providers/weatherapi.handler',
  link: [weatherCacheTable, weatherApiKey],
  timeout: '90 seconds',
  memory: '256 MB',
});

const openMeteoFunction = new sst.aws.Function('OpenMeteoFn', {
  handler: 'packages/functions/src/providers/open-meteo.handler',
  link: [weatherCacheTable],
  timeout: '90 seconds',
  memory: '256 MB',
});

// ── Phase 3 Lambda functions ──────────────────────────────────────────────────

const agent1CompareFunction = new sst.aws.Function('Agent1CompareFn', {
  handler: 'packages/functions/src/agents/compare.handler',
  timeout: '90 seconds',
  memory: '512 MB',
  // Bedrock access via IAM role — no resource link needed
});

const agent2FunnyTextFunction = new sst.aws.Function('Agent2FunnyTextFn', {
  handler: 'packages/functions/src/agents/funny-text.handler',
  link: [forecastsTable],
  timeout: '90 seconds',
  memory: '512 MB',
});

const checkImageCacheFunction = new sst.aws.Function('CheckImageCacheFn', {
  handler: 'packages/functions/src/agents/check-image-cache.handler',
  link: [forecastsTable],
  timeout: '30 seconds',
  memory: '256 MB',
});

const agent3ImageGenFunction = new sst.aws.Function('Agent3ImageGenFn', {
  handler: 'packages/functions/src/agents/image-gen.handler',
  link: [imagesBucket, imagesCdn],
  timeout: '90 seconds',
  memory: '1024 MB', // base64 decode + PNG buffer in memory
});

const saveForecastFunction = new sst.aws.Function('SaveForecastFn', {
  handler: 'packages/functions/src/save-forecast.handler',
  link: [forecastsTable],
  timeout: '30 seconds',
  memory: '256 MB',
});

// ── Bedrock InvokeModel permissions ──────────────────────────────────────────
//
// Agent 1 + 2 need Claude 3.5 Haiku; Agent 3 needs Titan Image Generator v2.
// IAM uses the model ARN wildcard pattern:
//   arn:aws:bedrock:{region}::foundation-model/{modelId}

const bedrockRegion = aws.getRegionOutput().name;

const bedrockTextPolicy = $resolve([bedrockRegion]).apply(([region]) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'bedrock:InvokeModel',
        Resource: `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0`,
      },
    ],
  }),
);

const bedrockImagePolicy = $resolve([bedrockRegion]).apply(([region]) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'bedrock:InvokeModel',
        Resource: `arn:aws:bedrock:${region}::foundation-model/amazon.titan-image-generator-v2:0`,
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

// Attach Bedrock image permission to Agent 3
new aws.iam.RolePolicy('Agent3BedrockPolicy', {
  role: agent3ImageGenFunction.nodes.role.id,
  policy: bedrockImagePolicy,
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
          Next: 'Agent2_FunnyText',
        },

        // ── Agent 2: Funny localized text ───────────────────────────────────
        Agent2_FunnyText: {
          Type: 'Task',
          Resource: agent2Arn,
          Parameters: {
            'city.$': '$.city',
            'language.$': '$.language',
            'date.$': '$.date',
            'consensus.$': '$.agentCompare.consensus',
          },
          ResultPath: '$.agentFunnyText',
          Retry: bedrockRetry,
          Next: 'CheckImageCache',
        },

        // ── Image cache lookup ──────────────────────────────────────────────
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
              Next: 'PrepareSaveFromCache',
            },
          ],
          Default: 'Agent3_ImageGen',
        },

        // ── Agent 3: Image generation (cache miss only) ─────────────────────
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
          ResultPath: '$.generatedImage',
          Retry: bedrockRetry,
          Next: 'PrepareSaveFromGen',
        },

        // Normalise inputs for SaveForecast — image from Titan generation
        PrepareSaveFromGen: {
          Type: 'Pass',
          Parameters: {
            'city.$': '$.city',
            'language.$': '$.language',
            'date.$': '$.date',
            'userId.$': '$.userId',
            'timeSlot.$': '$.timeSlot',
            'consensus.$': '$.agentCompare.consensus',
            'funnyText.$': '$.agentFunnyText.funnyText',
            'imageUrl.$': '$.generatedImage.imageUrl',
            'imageCacheKey.$': '$.generatedImage.imageCacheKey',
            'sourcesUsed.$': '$.agentCompare.sourcesUsed',
          },
          Next: 'SaveForecast',
        },

        // Normalise inputs for SaveForecast — image reused from cache
        PrepareSaveFromCache: {
          Type: 'Pass',
          Parameters: {
            'city.$': '$.city',
            'language.$': '$.language',
            'date.$': '$.date',
            'userId.$': '$.userId',
            'timeSlot.$': '$.timeSlot',
            'consensus.$': '$.agentCompare.consensus',
            'funnyText.$': '$.agentFunnyText.funnyText',
            'imageUrl.$': '$.imageCache.imageUrl',
            'imageCacheKey.$': '$.imageCache.imageCacheKey',
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
  // Full logging added in Phase 5 (requires a CloudWatch log group destination)
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
  ],
  timeout: '30 seconds',
  memory: '256 MB',
});

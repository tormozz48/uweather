/**
 * infra/pipeline.ts — Phase 2: weather provider fetch pipeline
 *
 * Resources provisioned here:
 *  - SST Secrets: OpenWeatherApiKey, WeatherApiKey
 *  - Lambda functions: CheckCacheFn, OpenWeatherFn, WeatherApiFn, OpenMeteoFn, OrchestratorFn
 *  - IAM execution role for Step Functions
 *  - Step Functions Standard Workflow: ForecastPipeline
 *
 * State machine flow (Phase 2):
 *   CheckCache ──► CacheDecision ──► CacheHitSuccess (Succeed)
 *                                └──► FetchWeather (Parallel)
 *                                       ├─ OpenWeather branch
 *                                       ├─ WeatherAPI branch
 *                                       └─ OpenMeteo branch
 *                                     └──► NormalizeAndMerge (Pass)
 *                                           └──► PipelineSuccess (Succeed)
 *
 * Phase 3 will replace NormalizeAndMerge with Agent1_Compare and extend the
 * pipeline with Agent2_FunnyText, CheckImageCache, Agent3_ImageGen, SaveForecast.
 *
 * No imports needed — sst, aws, $resolve, $interpolate, $app are SST globals.
 */
import { weatherCacheTable } from './storage';

// ── SST Secrets ───────────────────────────────────────────────────────────────

export const openWeatherApiKey = new sst.Secret('OpenWeatherApiKey');
export const weatherApiKey = new sst.Secret('WeatherApiKey');

// ── Lambda functions ──────────────────────────────────────────────────────────

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

// Allow Step Functions to invoke all provider + check-cache Lambdas
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
        ],
      },
    ],
  }),
});

// ── State machine definition ──────────────────────────────────────────────────

/**
 * Build a provider branch for the Parallel state.
 * Each branch retries twice, then catches any error into a typed failure Pass state
 * so the Parallel state always succeeds regardless of individual provider failures.
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
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: `${stateName}Error`,
          },
        ],
        End: true,
      },
      [`${stateName}Error`]: {
        // Return a typed failure result so agents/validation in Phase 3 can check
        // success flags instead of crashing the entire execution.
        Type: 'Pass',
        Result: { provider: providerName, success: false },
        End: true,
      },
    },
  };
}

/**
 * Full Amazon States Language definition.
 * Built as a typed object then serialised — ARNs are Pulumi Outputs resolved via $resolve.
 */
const smDefinition = $resolve([
  checkCacheFunction.arn,
  openWeatherFunction.arn,
  weatherApiFunction.arn,
  openMeteoFunction.arn,
]).apply(([checkCacheArn, openWeatherArn, weatherApiArn, openMeteoArn]) =>
  JSON.stringify({
    Comment: 'uweather forecast pipeline — Phase 2: parallel weather provider fetch',
    StartAt: 'CheckCache',
    TimeoutSeconds: 120,
    States: {
      // ── Cache check ───────────────────────────────────────────────────────
      CheckCache: {
        Type: 'Task',
        Resource: checkCacheArn,
        ResultPath: '$.cacheCheck',
        Retry: [{ ErrorEquals: ['States.ALL'], MaxAttempts: 1, IntervalSeconds: 1 }],
        // On transient cache-check failure, fall through to a fresh fetch
        Catch: [{ ErrorEquals: ['States.ALL'], ResultPath: null, Next: 'FetchWeather' }],
        Next: 'CacheDecision',
      },

      CacheDecision: {
        Type: 'Choice',
        Choices: [
          { Variable: '$.cacheCheck.cacheHit', BooleanEquals: true, Next: 'CacheHitSuccess' },
        ],
        Default: 'FetchWeather',
      },

      // Phase 3: CacheHitSuccess will transition to Agent1_Compare instead of Succeed,
      // passing $.cacheCheck.providers as input.
      CacheHitSuccess: { Type: 'Succeed' },

      // ── Parallel provider fetch ───────────────────────────────────────────
      FetchWeather: {
        Type: 'Parallel',
        Branches: [
          providerBranch('FetchOpenWeather', openWeatherArn, 'openweather'),
          providerBranch('FetchWeatherApi', weatherApiArn, 'weatherapi'),
          providerBranch('FetchOpenMeteo', openMeteoArn, 'open-meteo'),
        ],
        Next: 'NormalizeAndMerge',
      },

      // Phase 3 placeholder — will be replaced by Agent1_Compare Lambda (Bedrock Haiku)
      NormalizeAndMerge: {
        Type: 'Pass',
        Comment: 'Phase 3 placeholder — replaced by Agent1_Compare',
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
  // Full logging (with CloudWatch log group destination) added in Phase 5 (observability).
  // AWS requires a destination when level != OFF, so we leave it disabled here.
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

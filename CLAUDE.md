# uweather

AI-powered weather app that delivers funny, location-aware forecasts with generated images via web UI.

## Stack

- **Language**: TypeScript (end-to-end)
- **Runtime**: Node.js 20+
- **IaC**: SST v3 (Ion) → CloudFormation / Pulumi
- **Cloud**: AWS (serverless-only)
- **Web**: Vite + React SPA (anonymous, no auth)
- **AI — text**: Amazon Bedrock (Claude Haiku 4.5 inference profile)
- **AI — images**: Pixazo AI SDXL v1.0 REST API (external, no Bedrock)
- **Database**: DynamoDB (multi-table, on-demand billing)
- **Storage**: S3 (generated images, 90-day lifecycle) + CloudFront CDN
- **Orchestration**: AWS Step Functions Standard Workflow (parallel provider fan-out → sequential AI pipeline)
- **Real-time**: API Gateway WebSocket + EventBridge (pipeline stage progress pushed to browser)
- **Observability**: CloudWatch Logs (structured JSON/EMF), Metrics, Dashboards, Alarms, SNS, X-Ray

## AWS Services

All services used in the project, grouped by concern:

**Compute**

- **AWS Lambda** — one function per concern: 3 weather providers, 5 pipeline agents, 1 orchestrator, 4 HTTP API handlers, 3 WebSocket handlers, 1 save-forecast

**Orchestration**

- **AWS Step Functions** (Standard Workflow) — ForecastPipeline state machine; parallel fan-out for provider fetches, sequential AI agents, cache-decision Choice states, retry + catch on every task

**API**

- **Amazon API Gateway v2 (HTTP)** — REST API: `GET /health`, `GET /forecast`, `GET /forecast/status`, `GET /history`
- **Amazon API Gateway v2 (WebSocket)** — real-time pipeline progress: `$connect`, `$disconnect`, managed via `execute-api:ManageConnections`

**Eventing**

- **Amazon EventBridge** — two rules on the default bus: (1) custom `uweather.pipeline / StageProgress` events emitted by pipeline Lambdas; (2) built-in `Step Functions Execution Status Change` events for SUCCEEDED/FAILED/TIMED_OUT/ABORTED

**Storage**

- **Amazon DynamoDB** — four tables, all on-demand:
  - `WeatherCache` — normalized provider responses, 30-min TTL
  - `Forecasts` — completed forecast results; GSIs: `UserHistoryIndex` (userId + createdAt), `ImageCacheIndex` (imageCacheKey + createdAt)
  - `WebSocketConnections` — executionArn → connectionId mapping, 10-min TTL
  - `Users` — web user profiles and language preferences
- **Amazon S3** — `UweatherImages` bucket (CloudFront-restricted via OAC); 90-day object lifecycle
- **Amazon CloudFront** — CDN for generated images (`ImagesCdn` Router) + SPA hosting (`StaticSite`)

**AI**

- **Amazon Bedrock** — Claude Haiku 4.5 invoked via inference profile (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) for Agent 1 (compare), Agent 2 (funny text), and ResolveLandmark fallback

**Observability**

- **Amazon CloudWatch Logs** — structured JSON logs from all Lambdas; Step Functions execution logs (ERROR level, 30-day retention)
- **Amazon CloudWatch Metrics** — custom EMF metrics: `WeatherCacheHit/Miss`, `ImageCacheHit/Miss`, `ProviderSuccess/Error`, `BedrockLatency`, `BedrockThrottled`, `ImageGenerationCount`, `LowConfidenceForecast`
- **Amazon CloudWatch Dashboards** — `uweather-{stage}`: 7 panels (SFN executions, cache rates, provider reliability, Bedrock latency, throttling, API errors)
- **Amazon CloudWatch Alarms** — 4 alarms: SFN failures, provider error rate (>5/5min), orchestrator P99 duration (>25s), Bedrock throttle rate (>3/5min)
- **AWS X-Ray** — active tracing on all Lambdas and Step Functions; traces propagate end-to-end from API Gateway through SFN into each Lambda
- **Amazon SNS** — `AlarmTopic` for alarm notifications (email subscription)

**Security & Config**

- **AWS IAM** — least-privilege execution roles per Lambda; separate policies for Bedrock InvokeModel, SFN StartExecution/DescribeExecution, EventBridge PutEvents, X-Ray, execute-api ManageConnections
- **SST Secrets (AWS SSM Parameter Store)** — `OpenWeatherApiKey`, `WeatherApiKey`, `PixazoApiKey` (never in environment variables directly)

## Commands

```bash
pnpm install                     # install all workspace deps
pnpm sst dev                     # start SST dev mode (live Lambda)
pnpm sst deploy --stage prod     # deploy to production
pnpm --filter web dev            # local web dev server
```

## Deployment Stages

- `dev` — development (used with `sst dev` for live Lambda debugging)
- `prod` — production

## Conventions

- One Lambda per concern (one per weather provider, one per AI agent)
- All Lambdas use shared structured logger from `packages/core`
- Weather provider responses are normalized to `UnifiedWeatherData` type before processing
- DynamoDB tables use on-demand billing mode (no capacity planning)
- All AI prompts live in `packages/core/src/prompts/` as template functions
- Image cache key: `{city}:{date}:{timeSlot}:{condition}:{tempBucket}` (see TECHNICAL_SPEC.md)
- Follow Karpathy Guidelines from SKILL.md: simplicity first, surgical changes, goal-driven execution

## Key Architecture Decisions

See `docs/adr/001-architecture.md` for full context. Summary:

- Step Functions for orchestration (not SQS) — handles parallel fan-out/fan-in natively
- DynamoDB for cache (not ElastiCache) — serverless, pay-per-use, TTL built-in
- Bedrock Haiku for text agents — cheapest option with good quality
- Titan Image Gen v2 — $0.008/image, cheapest on Bedrock
- Image caching per location+conditions — reuse across users to cut costs
- Multi-table DynamoDB — WeatherCache, Forecasts, Users (see TECHNICAL_SPEC.md)

## Environment Variables

Managed by SST via `Resource` bindings (not .env files):

- `OPENWEATHER_API_KEY` — via SST Secret
- `WEATHERAPI_KEY` — via SST Secret
- Bedrock, DynamoDB, S3 — accessed via IAM roles (no keys needed)

## Coding Principles

These rules apply to all code in this repository. Enforce them on every new file and every edit.

1. **No one-letter variables** — use descriptive names at every scope. `suggestion` not `s`, `forecast` not `f`, `index` not `i`, `prev` not the shadowed outer name.

2. **Short functions** — aim for ≤20 lines per function. If a function is doing more than one thing, extract a named helper. Lambda handlers orchestrate; helpers compute.

3. **Pure functions without side effects** — separate data transformation from I/O. A function that transforms data should not also log, emit metrics, or mutate state. Keep pure helpers at the top of the file, effectful orchestration at the bottom.

4. **No magic numbers** — every numeric literal that carries meaning must be a named constant. Place it at the top of the file with a descriptive name and a comment explaining the unit (e.g. `const WIKIDATA_QUERY_TIMEOUT_MS = 8000`).

5. **No magic strings** — repeated or meaningful string literals must be named constants. This includes API URLs, DynamoDB key prefixes, HTTP headers, cache-control directives, and regex patterns.

6. **No code duplication** — before writing a utility function, check `packages/core/src/utils/` for an existing one. If the same logic appears in more than one file, extract it to core and import it. Key shared utilities: `degreesToCardinal` (wind), `stripMarkdownFence` (Bedrock response cleaning), `getTempBucket`, `buildImageCacheKey`.

7. **Single responsibility** — each module, class, and function owns exactly one concern. Lambda handlers start the pipeline and return results; they delegate data shaping to pure helpers, DB access to service classes, and prompt building to `packages/core/src/prompts/`.

8. **Keep README.md in sync** — after any change that affects content already documented in `README.md` (stack, commands, API surface, infrastructure layout, observability setup, environment variables, repo structure, dev conventions), update the relevant section of `README.md` in the same commit.

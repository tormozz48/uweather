# uweather

An AI-powered weather app that delivers funny, location-aware forecasts with generated images. Enter a city and get a real weather report written by AI — with a unique illustration to match the conditions.

## How it works

A request for a forecast kicks off a Step Functions pipeline:

1. **Provider fan-out** — three weather providers (OpenWeatherMap, WeatherAPI, Open-Meteo) are fetched in parallel
2. **Agent 1: Compare** — Bedrock (Claude Haiku) normalizes and reconciles the provider data into a consensus weather summary
3. **Agent 2: Funny text** — Bedrock writes a humorous, localized forecast narrative in the user's language
4. **Agent 3: Image generation** — Pixazo AI generates an illustration matching the conditions; cached by location + conditions to avoid redundant calls
5. **Save & serve** — result is stored in DynamoDB + S3 and streamed back to the browser via WebSocket

Cache hits at either the weather or image level short-circuit the pipeline. Real-time progress is pushed to the browser as each stage completes.

## Stack

| Concern | Technology |
|---|---|
| Language | TypeScript (end-to-end) |
| Runtime | Node.js 20+ |
| IaC | SST v3 (Ion) → CloudFormation / Pulumi |
| Cloud | AWS (serverless-only) |
| Frontend | Vite + React SPA |
| AI — text | Amazon Bedrock (Claude Haiku 4.5) |
| AI — images | Pixazo AI SDXL v1.0 REST API |
| Database | DynamoDB (multi-table, on-demand) |
| Storage | S3 + CloudFront CDN |
| Orchestration | AWS Step Functions Standard Workflow |
| Real-time | API Gateway WebSocket + EventBridge |
| Observability | CloudWatch Logs, Metrics, Dashboards, Alarms, X-Ray |

## Repository layout

```
packages/
  core/        # Shared types, prompts, utilities
  functions/   # All Lambda handlers (providers, agents, API, WebSocket)
  web/         # Vite + React SPA
infra/         # SST resource definitions (API, storage, pipeline, monitoring)
docs/          # Architecture decision records, technical spec, implementation plan
```

## Getting started

**Prerequisites:** Node.js 20+, pnpm, an AWS account with a profile named `uweather`, and API keys for OpenWeatherMap, WeatherAPI, and Pixazo.

```bash
# Install dependencies
pnpm install

# Set secrets (one-time)
pnpm sst secret set OpenWeatherApiKey <key>
pnpm sst secret set WeatherApiKey <key>
pnpm sst secret set PixazoApiKey <key>

# Start SST dev mode (live Lambda, hot reload)
pnpm dev

# Local web dev server (in a separate terminal)
pnpm --filter web dev
```

## Commands

```bash
pnpm dev                  # SST dev mode with live Lambda
pnpm build                # TypeScript build (all packages)
pnpm typecheck            # Type-check without emitting
pnpm lint                 # Biome lint
pnpm check                # Biome lint + format (writes)
pnpm deploy-dev           # Deploy to dev stage
pnpm deploy-prod          # Deploy to prod stage
```

## Deployment stages

- `dev` — development, used with `sst dev` for live Lambda debugging
- `prod` — production

## API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/forecast?city=...` | Start or return a cached forecast |
| GET | `/forecast/status?executionArn=...` | Poll pipeline execution status |
| GET | `/history` | Past forecasts for the current session |

Real-time progress updates are delivered over a WebSocket connection. The browser opens a connection before triggering a forecast; Step Functions emits stage events via EventBridge, which fan out to all active connections for that execution.

## Infrastructure overview

All resources are defined under `infra/` and composed in `sst.config.ts`:

- **`storage.ts`** — DynamoDB tables (WeatherCache, Forecasts, Users, WebSocketConnections), S3 bucket, CloudFront distributions
- **`pipeline.ts`** — Step Functions state machine (ForecastPipeline), all pipeline Lambda functions
- **`api.ts`** — API Gateway HTTP API and Lambda handlers
- **`realtime.ts`** — API Gateway WebSocket API, EventBridge rules, push-stage Lambda
- **`monitoring.ts`** — CloudWatch dashboards, alarms, SNS topic

## Observability

Custom CloudWatch EMF metrics are emitted by each Lambda:

- `WeatherCacheHit` / `WeatherCacheMiss`
- `ImageCacheHit` / `ImageCacheMiss`
- `ProviderSuccess` / `ProviderError` (per provider)
- `BedrockLatency`, `BedrockThrottled`
- `ImageGenerationCount`, `LowConfidenceForecast`

A CloudWatch dashboard (`uweather-{stage}`) aggregates these across 7 panels. Four alarms cover Step Functions failures, provider error rate, orchestrator P99 latency, and Bedrock throttle rate.

All Lambdas and the Step Functions state machine have X-Ray active tracing enabled, with traces propagating end-to-end from API Gateway through to each provider and agent Lambda.

## Development notes

- One Lambda per concern — providers, agents, API handlers, and WebSocket handlers are all separate functions
- All AI prompts live in `packages/core/src/prompts/` as typed template functions
- Shared utilities (`degreesToCardinal`, `stripMarkdownFence`, `getTempBucket`, `buildImageCacheKey`, etc.) live in `packages/core/src/utils/` — check there before writing a new one
- Biome handles linting and formatting; a pre-push hook enforces it
- See `docs/adr/001-architecture.md` for the reasoning behind major infrastructure choices
- See `docs/TECHNICAL_SPEC.md` for DynamoDB schemas and access patterns

## License

MIT

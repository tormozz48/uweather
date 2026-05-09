# uweather

AI-powered weather app that delivers funny, location-aware forecasts with generated images via Telegram bot and web UI.

## Stack

- **Language**: TypeScript (end-to-end)
- **Runtime**: Node.js 20+
- **IaC**: SST v3 (Ion) → CloudFormation
- **Cloud**: AWS (serverless-only)
- **Telegram**: grammY (webhook mode, not polling)
- **Web**: Vite + React SPA (anonymous, no auth)
- **AI**: Amazon Bedrock (Claude 4.5 Haiku for text, Titan Image Generator v2 for images)
- **Database**: DynamoDB (multi-table, on-demand billing)
- **Storage**: S3 (generated images) + CloudFront CDN
- **Orchestration**: AWS Step Functions (parallel provider fetch → sequential AI pipeline)
- **Observability**: CloudWatch Logs (structured JSON), Metrics, Dashboards, Alarms, X-Ray

## Project Structure

```
uweather/
├── CLAUDE.md
├── sst.config.ts
├── package.json                  # workspace root
├── docs/
│   ├── adr/
│   │   └── 001-architecture.md   # architecture decision record
│   └── TECHNICAL_SPEC.md         # DynamoDB schemas, API, cache keys, prompts
├── packages/
│   ├── core/                     # shared types, weather models, utils
│   │   └── src/
│   │       ├── types/            # WeatherData, Forecast, User, etc.
│   │       ├── weather/          # provider response transformers
│   │       └── utils/            # logger, cache keys, validation
│   ├── functions/                # all Lambda handlers
│   │   └── src/
│   │       ├── orchestrator.ts   # cache check → start Step Functions
│   │       ├── providers/
│   │       │   ├── openweather.ts
│   │       │   ├── weatherapi.ts
│   │       │   └── open-meteo.ts
│   │       ├── agents/
│   │       │   ├── compare.ts    # Agent 1: weather comparison
│   │       │   ├── funny-text.ts # Agent 2: localized funny text
│   │       │   └── image-gen.ts  # Agent 3: image generation
│   │       ├── telegram/
│   │       │   └── webhook.ts    # grammY webhook handler
│   │       └── api/
│   │           ├── forecast.ts   # GET /forecast?city=X&lang=Y
│   │           └── history.ts    # GET /history?userId=X
│   └── web/                      # Vite + React SPA
│       ├── src/
│       ├── index.html
│       └── vite.config.ts
└── infra/                        # SST stack definitions
    ├── storage.ts                # DynamoDB tables, S3 bucket
    ├── api.ts                    # API Gateway, Lambda functions
    ├── pipeline.ts               # Step Functions state machine
    ├── web.ts                    # StaticSite (S3 + CloudFront)
    └── monitoring.ts             # CloudWatch dashboards, alarms
```

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
- Telegram bot uses "send loading → edit with result" pattern
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

- `TELEGRAM_BOT_TOKEN` — via SST Secret
- `OPENWEATHER_API_KEY` — via SST Secret
- `WEATHERAPI_KEY` — via SST Secret
- Bedrock, DynamoDB, S3 — accessed via IAM roles (no keys needed)

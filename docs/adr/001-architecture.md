# ADR-001: uweather Architecture

**Date**: 2026-05-09
**Status**: Accepted
**Confidence**: High confidence (minor unknowns around Titan Image quality)

## Problem

We need to design a serverless architecture for uweather — an AI-powered weather application that aggregates data from multiple providers, processes it through three AI agents, and delivers personalized forecasts via Telegram bot and web interface. The architecture must be cost-effective for hundreds of users, fully serverless on AWS, and deployable via Infrastructure as Code in TypeScript.

## Context

- Target scale: hundreds of users (MVP), ~500 requests/day
- Single developer (founder), so operational simplicity matters
- TypeScript end-to-end is a hard requirement
- AWS is the only cloud provider under consideration
- Serverless-only — no EC2, ECS, or always-on infrastructure
- Future expansion: Android app, scheduled notifications, location knowledge base
- Budget-conscious: estimated target < $50/month at MVP scale

## Requirements

| # | Requirement | Priority |
|---|-------------|----------|
| R1 | Aggregate weather from 3+ free providers | Must |
| R2 | AI Agent 1: compare/average provider data | Must |
| R3 | AI Agent 2: funny localized text with landmarks | Must |
| R4 | AI Agent 3: generate unique weather image | Must |
| R5 | Telegram bot interface (webhook) | Must |
| R6 | Web SPA interface (anonymous) | Must |
| R7 | All TypeScript/Node.js | Must |
| R8 | AWS serverless infrastructure | Must |
| R9 | IaC deployment in TypeScript | Must |
| R10 | Weather data caching to reduce API calls | Must |
| R11 | Image caching/reuse across users | Must |
| R12 | Multi-language support (user's language) | Must |
| R13 | Forecast history (past results viewable) | Must |
| R14 | Observability (logs, metrics, dashboards, tracing) | Must |
| R15 | Cost < $50/month at MVP scale | Should |
| R16 | Android app support | Future |
| R17 | Scheduled daily notifications | Future |

## Decision Drivers

1. **Cost at low scale** — hundreds of users must not incur fixed infrastructure costs; pay-per-use is essential
2. **Orchestration complexity** — three parallel provider fetches followed by three sequential AI agents requires reliable fan-out/fan-in
3. **TypeScript DX** — IaC, business logic, and frontend must share types and tooling
4. **Operational simplicity** — single developer; minimize moving parts and ops burden
5. **AI model cost per request** — image generation is the dominant cost driver

## Decisions

### 1. IaC Framework: SST v3

SST v3 (Ion) provides TypeScript-native IaC built on top of Pulumi/CloudFormation. It offers live Lambda debugging via `sst dev`, first-class constructs for API Gateway, DynamoDB, S3, StaticSite, and Step Functions. Compared to raw CDK (verbose) or SAM (YAML-based), SST gives the best DX for a single-developer serverless TypeScript project.

When CDK would make sense: if the project outgrows SST's abstractions or requires advanced CloudFormation features SST doesn't expose.

### 2. Orchestration: AWS Step Functions (not SQS)

Step Functions provides native Parallel state for fan-out/fan-in of weather provider Lambdas, then sequential execution for the AI pipeline. The entire forecast flow is a single state machine with built-in error handling, retries, and execution history.

SQS was considered for decoupling weather providers, but introduces async complexity (no native "wait for all to complete") and requires additional infrastructure for synchronization. SQS is retained only as dead-letter queues for failed executions.

When SQS would make sense: if we add scheduled notifications (high fan-out to many users) or need to absorb traffic spikes beyond Step Functions' concurrency limits.

### 3. Weather Providers: OpenWeatherMap + WeatherAPI + Open-Meteo

Three providers with generous free tiers: OpenWeatherMap (1,000 calls/day free), WeatherAPI (1M calls/month free), Open-Meteo (fully free, no API key). Each provider gets its own Lambda function. Responses are normalized to a shared `UnifiedWeatherData` type in `packages/core`.

### 4. Cache: DynamoDB with TTL (not ElastiCache)

DynamoDB with a 30-minute TTL on the WeatherCache table. At this scale, ElastiCache (minimum ~$13/month for a `cache.t3.micro`) is overkill and not serverless. DynamoDB on-demand costs effectively $0 at hundreds of users and requires zero capacity management.

When ElastiCache would make sense: if cache read latency becomes critical (sub-millisecond needed) or request volume exceeds thousands per minute.

### 5. AI Models: Amazon Bedrock

- **Agents 1 & 2 (text)**: Claude 3.5 Haiku via Bedrock — ~$0.25/1M input tokens, ~$1.25/1M output tokens. Fast, cheap, strong at structured analysis and creative writing.
- **Agent 3 (image)**: Amazon Titan Image Generator v2 — ~$0.008 per 512×512 image. Cheapest image generation on Bedrock.

All accessed via Bedrock API (no self-hosted models, no external API keys for AI). IAM roles handle auth.

When upgrading would make sense: if Titan image quality is insufficient, upgrade to Stable Diffusion XL on Bedrock (~$0.04/image, 5× cost). If text quality needs improvement, upgrade to Claude 3.5 Sonnet.

### 6. Image Caching Strategy

Generated images are stored in S3, served via CloudFront CDN. Cache key: `{city_normalized}:{date}:{time_slot}:{condition}:{temp_bucket}`.

- `time_slot`: morning | afternoon | evening | night
- `condition`: sunny | partly_cloudy | cloudy | rain | snow | thunderstorm | fog | windy
- `temp_bucket`: freezing (<0°C) | cold (0-10) | cool (10-18) | mild (18-24) | warm (24-30) | hot (>30)

When a request matches an existing cache key, the stored image is reused. New images generate only for new key combinations. At steady state, most requests should hit the image cache.

### 7. Database: Multi-Table DynamoDB

Three separate tables (detailed schemas in TECHNICAL_SPEC.md):

- **WeatherCache** — TTL-based, stores normalized provider responses
- **Forecasts** — stores complete forecast results (text, image URL, metadata), supports history queries
- **Users** — stores Telegram chat IDs, language preferences, location

Multi-table chosen over single-table design for clarity and independent scaling. At this scale, the operational overhead of multiple tables is negligible.

### 8. Telegram Bot: grammY (Webhook Mode)

grammY is TypeScript-native, lightweight, and designed for serverless (webhook mode). The bot uses "send loading message → edit with result" UX pattern. Compared to Telegraf (heavier, older API), grammY has better TypeScript support and smaller bundle size.

### 9. Web App: Vite + React SPA

Static SPA deployed to S3 + CloudFront via SST's `StaticSite` construct. Anonymous access — user enters city and language, gets forecast. No user accounts for MVP.

### 10. Observability

- **CloudWatch Logs**: structured JSON logging via Powertools for AWS Lambda (TypeScript)
- **CloudWatch Metrics**: custom metrics (cache hit rate, provider latency, Bedrock latency, e2e forecast time)
- **CloudWatch Dashboard**: single dashboard with provider health, AI pipeline latency, error rates, cost tracking
- **CloudWatch Alarms**: error rate >5%, Step Functions failure >1%, Lambda near-timeout (>75s of 90s). Notify via SNS → email
- **X-Ray**: distributed tracing across all Lambdas and API Gateway

## Trade-offs

- **Step Functions over SQS** — we lose true decoupling and event-driven architecture; gain simplicity and synchronous-like flow. Adding scheduled notifications later may require introducing SQS/EventBridge.
- **DynamoDB over ElastiCache** — slightly higher read latency (~5ms vs <1ms); gain zero fixed cost and serverless model.
- **Titan Image over SDXL** — lower image quality; gain 5× cost reduction. Can upgrade later without architectural changes.
- **Bedrock over external APIs (OpenAI)** — limited to Bedrock model catalog; gain single-vendor IAM auth, no API key management, AWS data residency.
- **Multi-table over single-table DynamoDB** — slightly more IaC definitions; gain clarity, simpler access patterns, independent table-level metrics.

## Out of Scope (MVP)

- Scheduled notifications / daily digests (next iteration)
- Android mobile app (future)
- User authentication or accounts on web
- Location knowledge base (rely on LLM training data)
- Multi-day forecasts (today only for MVP)
- Rate limiting / abuse protection (not needed at hundreds of users)
- CI/CD pipeline (manual `sst deploy` for now)

## Next Steps

1. **Scaffold SST v3 monorepo** — initialize with `packages/core`, `packages/functions`, `packages/web`, `infra/` structure. Validate: `sst dev` starts without errors.
2. **Implement weather provider Lambdas** — one per provider, normalize to `UnifiedWeatherData`. Validate: each returns valid normalized data for a test city.
3. **Define Step Functions state machine** — parallel providers → sequential agents with error handling. Validate: successful execution in AWS console with mock data.
4. **Integrate Bedrock agents** — implement prompt templates, wire up Haiku and Titan calls. Validate: agent outputs match expected format for test inputs.
5. **Build Telegram bot** — grammY webhook, loading/edit pattern. Validate: end-to-end forecast flow works in Telegram for a test city.
6. **Build web SPA** — forecast and history views. Validate: matches Telegram output for same city.
7. **Deploy observability** — dashboard, alarms, X-Ray. Validate: all metrics populate after 10 test requests; alarm triggers on simulated failure.
8. **Cost validation gate (2 weeks post-launch)** — confirm monthly run rate < $50 with real usage data.

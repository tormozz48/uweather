# uweather — Implementation Plan

**Date**: 2026-05-09
**Status**: Approved
**Approach**: Vertical slices — each phase delivers a deployable, working system
**Stub strategy**: No stubs — all components use real implementations from the start

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MVP surface | Web only (Telegram deferred) | Telegram adds complexity without being critical for early validation; web SPA covers the full pipeline |
| AI agent stubs | None — all real | Each phase delivers real value; Bedrock access must be enabled early |
| Image generation | Pixazo SDXL (not Bedrock Titan) | Significantly better image quality; trade-off is external API dependency and key management |
| Real-time UX | WebSocket + EventBridge (not polling) | Pipeline takes 15–30s; per-stage progress updates substantially reduce perceived wait |
| Landmark resolution | Wikidata SPARQL + Bedrock fallback | Free data source, surprisingly good coverage; Bedrock only activates when Wikidata returns <3 results |
| Monorepo config | Shared tsconfig with project references | Simpler for project size, still type-safe across packages |
| Linter/formatter | Biome (strict) | Single tool replacing ESLint + Prettier; Rust-based, fast, simple config |
| Node.js runtime | Node 20 (LTS) | Battle-tested Lambda support, SST fully supports it |
| Package manager | pnpm (latest stable) | Workspace support, fast installs, strict dependency resolution |

## Biome Configuration

- **Ruleset**: `recommended` preset
- **Linting**: `correctness` and `suspicious` at error level, `style` at warn
- **Formatting**: 2-space indent, 100-char print width, single quotes, trailing commas (all)
- **Import organization**: enabled (auto-sort on format)
- **Files ignored**: `node_modules`, `.sst`, `dist`, `build`, `.turbo`

Rationale: Biome covers ~95% of ESLint+Prettier needs in a single binary. The main gap is no `eslint-plugin-react-hooks` exhaustive-deps equivalent — acceptable tradeoff for this project. 100-char print width chosen over default 80 to accommodate TypeScript's verbose type annotations.

---

## Phase 0 — Foundation

**Timeline**: Day 1
**Goal**: Scaffolded monorepo that builds, lints, and deploys an empty SST app

### Tasks

1. Initialize pnpm workspace with `pnpm-workspace.yaml` defining `packages/*` and `infra`
2. Create root `package.json` with workspace scripts: `dev`, `build`, `lint`, `format`, `typecheck`
3. Create root `tsconfig.json` with project references to `packages/core`, `packages/functions`, `packages/web`
4. Configure `biome.json` at root with strict settings (see Biome Configuration above)
5. Scaffold three packages:
   - `packages/core/` — `package.json`, `tsconfig.json`, `src/index.ts`
   - `packages/functions/` — `package.json`, `tsconfig.json`, `src/index.ts`
   - `packages/web/` — Vite + React scaffold with `vite.config.ts`
6. Initialize `sst.config.ts` with app name `uweather`, two stages (`dev`, `prod`)
7. Create `infra/` skeleton files with minimal exports:
   - `storage.ts` — empty table/bucket definitions
   - `api.ts` — empty API definition
   - `pipeline.ts` — empty state machine
   - `web.ts` — empty StaticSite
   - `monitoring.ts` — empty dashboard
8. Add `.gitignore` entries: `node_modules`, `.sst`, `dist`, `*.js` (in src dirs), `.env`

### Verification

- `pnpm install` completes without errors
- `pnpm biome check .` passes (zero violations)
- `pnpm tsc --noEmit` passes across all packages
- `pnpm sst dev` starts without errors (deploys empty stack)

---

## Phase 1 — Core Types + Storage + Health Endpoint

**Timeline**: Days 2–3
**Goal**: Shared type system, all DynamoDB tables deployed, health endpoint reachable via HTTPS

### Tasks

1. `packages/core/src/types/` — define all shared types:
   - `weather.ts`: `UnifiedWeatherData`, `WeatherCondition`, `ConsensusForecast`
   - `forecast.ts`: `ForecastResult`, `ForecastResponse` (API shape)
   - `user.ts`: `UserProfile`, `UserPlatform`
   - `cache.ts`: `WeatherCacheEntry`, `ImageCacheEntry`
2. `packages/core/src/utils/` — shared utilities:
   - `logger.ts`: structured JSON logger (wraps Powertools for AWS Lambda or lightweight custom)
   - `cache-key.ts`: `buildImageCacheKey()` — city normalization, time slot derivation, condition/temp bucket mapping
   - `city.ts`: `normalizeCity()` — lowercase, trim, remove diacritics
   - `time.ts`: `getTimeSlot()` — morning/afternoon/evening/night from hour
3. `infra/storage.ts` — provision real resources:
   - `WeatherCache` DynamoDB table (PK: `pk`, SK: `sk`, TTL on `ttl` field)
   - `Forecasts` DynamoDB table (PK: `pk`, SK: `sk`) + GSIs: `UserHistoryIndex`, `ImageCacheIndex`
   - `Users` DynamoDB table (PK: `pk`, SK: `sk`)
   - S3 bucket `uweather-images-{stage}` with lifecycle policy
   - CloudFront distribution pointing to S3 bucket
4. `infra/api.ts` — API Gateway HTTP API with:
   - `GET /health` → `packages/functions/src/api/health.ts` (returns `{ status: "ok", stage, timestamp }`)
5. Wire SST resource bindings so functions can access tables/bucket via `Resource`

### Verification

- Deploy to `dev` stage
- `curl https://{api-url}/health` returns 200 with JSON
- DynamoDB tables visible in AWS console with correct schemas
- S3 bucket and CloudFront distribution created

---

## Phase 2 — Weather Providers

**Timeline**: Days 4–6
**Goal**: Orchestrator fetches weather from 3 providers in parallel, caches results in DynamoDB

### Tasks

1. `packages/core/src/weather/` — provider response transformers:
   - `openweather.ts`: transform OpenWeatherMap API response → `UnifiedWeatherData`
   - `weatherapi.ts`: transform WeatherAPI response → `UnifiedWeatherData`
   - `open-meteo.ts`: transform Open-Meteo response → `UnifiedWeatherData`
2. `packages/functions/src/providers/` — one Lambda per provider:
   - `openweather.ts`: fetch from OpenWeatherMap API, transform, write to WeatherCache
   - `weatherapi.ts`: fetch from WeatherAPI, transform, write to WeatherCache
   - `open-meteo.ts`: fetch from Open-Meteo API, transform, write to WeatherCache
   - Each handles its own errors, returns normalized data or error status
3. `packages/functions/src/orchestrator.ts`:
   - Accept `{ city, language }` input
   - Check WeatherCache for fresh data (< 30 min)
   - If cache miss: start Step Functions execution
   - If cache hit: skip to agents (or return cached forecast if full pipeline was cached)
4. `infra/pipeline.ts` — Step Functions state machine (partial):
   - `CheckCache` → `FetchWeather` (Parallel: 3 provider Lambdas) → `NormalizeAndMerge` (Pass state)
   - Each provider branch: retry 2x with exponential backoff, catch errors
   - Validation: at least 2 of 3 providers must succeed
5. SST Secrets: `OPENWEATHER_API_KEY`, `WEATHERAPI_KEY` (Open-Meteo needs no key)

### Verification

- Invoke orchestrator with `{ "city": "Kyiv" }` → cache miss → Step Functions runs
- All 3 providers return valid `UnifiedWeatherData`
- WeatherCache table has 3 entries for `CACHE#kyiv`
- Second invocation within 30 min → cache hit (no Step Functions)
- Simulate one provider failure → pipeline still succeeds with 2 providers

---

## Phase 3 — AI Agents Pipeline

**Timeline**: Days 7–10
**Goal**: Full end-to-end pipeline — weather fetch → AI comparison → landmark resolution → funny text → image generation → stored forecast

### Prerequisites

- **Enable Bedrock model access** in AWS Console for:
  - Claude Haiku 4.5 (text generation — compare, funny-text, landmark fallback)
  - Note: approval can take a few hours — request on Day 1
- **Pixazo API key**: obtain from gateway.pixazo.ai, store as `PixazoApiKey` SST Secret

### Tasks

1. `packages/core/src/prompts/` — prompt template functions:
   - `compare.ts`: system + user prompt for Agent 1 (weather comparison)
   - `funny-text.ts`: system + user prompt for Agent 2 (localized humor)
   - `image-gen.ts`: positive + negative prompts for Agent 3 (Pixazo SDXL)
   - `resolve-landmark.ts`: Bedrock fallback prompt for landmark resolution
2. `packages/functions/src/agents/`:
   - `compare.ts` (Agent 1): invoke Bedrock Haiku, input = array of `UnifiedWeatherData`, output = `ConsensusForecast` JSON
   - `resolve-landmark.ts`: primary — Wikidata SPARQL; fallback — Bedrock Haiku. Output: 3–5 landmark names for the city
   - `funny-text.ts` (Agent 2): invoke Bedrock Haiku, input = `ConsensusForecast` + city + language + landmark names + recent history, output = string (2–3 paragraphs)
   - `image-gen.ts` (Agent 3): call Pixazo SDXL API, upload PNG to S3, return CloudFront URL
3. `packages/functions/src/agents/check-image-cache.ts`:
   - Build image cache key from consensus data
   - Query `ImageCacheIndex` GSI on Forecasts table
   - Return existing `imageUrl` or signal cache miss
4. `packages/functions/src/save-forecast.ts`:
   - Write complete `ForecastResult` to Forecasts table
   - Include all fields: weatherSummary, funnyText, imageUrl, imageCacheKey, sourcesUsed
5. `infra/pipeline.ts` — extend state machine with full flow:
   - → `Agent1_Compare` → `ResolveLandmark` → `ParallelAgents` (Agent2_FunnyText ‖ CheckImageCache → Agent3_ImageGen)
   - → `NormalizeParallelResults` → `SaveForecast`
   - Bedrock calls: retry 2× on ThrottlingException only
   - Individual Lambda timeout: 30–90 seconds depending on function
   - Full pipeline timeout: 300 seconds
6. IAM: grant Bedrock `InvokeModel` permission for Haiku to Agent1, Agent2, ResolveLandmark Lambdas

### Verification

- End-to-end: invoke orchestrator with `{ "city": "Kyiv", "language": "en" }`
- Agent 1 returns valid `ConsensusForecast` JSON
- Agent 2 returns funny English text mentioning Kyiv landmarks
- Agent 3 generates image, uploaded to S3, accessible via CloudFront URL
- Forecast record exists in DynamoDB Forecasts table with all fields populated
- Second request for same city/conditions → image cache hit (no Titan call)
- Test with different language (e.g., `"uk"`) → Ukrainian text output

---

## Phase 4 — Real-time API + Web UI

**Timeline**: Days 11–15
**Goal**: Web SPA working end-to-end with real-time pipeline progress

> **Note**: Telegram bot is deferred post-MVP. Only the web surface is delivered in Phase 4.

### Tasks — Real-time API + WebSocket

1. `infra/realtime.ts` — WebSocket API (`PipelineWsApi`):
   - `$connect` route → `ws-connect.ts`: stores `executionArn → connectionId` in `WebSocketConnections` table (10-min TTL)
   - `$disconnect` route → `ws-disconnect.ts`: removes connection entry
2. `packages/core/src/types/` — add `PipelineStageId`, `StageProgressMessage`, `VISUAL_STAGES`
3. `packages/functions/src/shared/report-stage.ts` — helper to emit `StageProgress` EventBridge events
4. `infra/realtime.ts` — EventBridge rules:
   - Rule 1: `uweather.pipeline` / `StageProgress` → `wsPushStage` Lambda
   - Rule 2: Step Functions SUCCEEDED/FAILED/TIMED_OUT/ABORTED → `wsPushStage` Lambda
5. `wsPushStage` Lambda: look up connections by executionArn, call `ManageConnections` API

### Tasks — Web UI

1. `packages/web/` — Vite + React SPA:
   - Main view: city input (with autocomplete), language selector dropdown
   - Forecast display: weather card (temp, condition, humidity, wind), funny text block, generated image
   - Pipeline progress: real-time indicator showing 7 visual stage groups via WebSocket (`usePipelineProgress` hook)
   - History view: scrollable list of past forecasts (by anonymous session ID)
   - Loading state: live pipeline progress while pipeline runs (15–30s)
   - Error state: user-friendly error card with failure details
   - Responsive design (mobile-friendly)
2. API client (`packages/web/src/api.ts`): fetch wrappers for `/forecast`, `/forecast/status`, `/history`
3. `packages/functions/src/api/forecast.ts`:
   - Parse + validate city query param
   - Invoke orchestrator, return 202 `{ status: "pending", executionArn }`
4. `packages/functions/src/api/forecast-status.ts`:
   - Accept `executionArn` param, call SFN `DescribeExecution`
   - If SUCCEEDED: fetch ForecastResult from DynamoDB, return 200 with full forecast
   - If RUNNING: return 202 `{ status: "pending" }`
5. `packages/functions/src/api/history.ts`:
   - Query `UserHistoryIndex` GSI by userId, return last N forecasts
6. `infra/web.ts` — SST `StaticSite` pointing to `packages/web/`, CloudFront distribution
   - Inject `VITE_API_URL` and `VITE_WS_URL` at build time

### Verification

- Web: open URL, enter "Kyiv", select "en" → pipeline progress indicator shows each stage → forecast card with image renders
- Web: WebSocket connection established on load; disconnects cleanly after pipeline completes
- `/forecast` returns 202 immediately with executionArn
- `/forecast/status?executionArn=...` returns 202 while running, 200 with full forecast on completion
- Web: refresh page → history shows previous forecast

---

## Phase 5 — Observability + Hardening

**Timeline**: Days 16–18
**Goal**: Production-grade monitoring, alerting, and tracing

### Tasks

1. `packages/core/src/utils/logger.ts` — structured logger with `createLogger()`:
   - Auto-include `service`, `function`, `requestId`, `correlationId`, `city`
   - Log levels: DEBUG, INFO, WARN, ERROR
2. `packages/core/src/utils/metrics.ts` — `emitMetric()` using EMF (Embedded Metrics Format)
3. Add structured logging + metric emission to all Lambda functions
4. `infra/monitoring.ts` — CloudWatch resources:
   - Dashboard `uweather-{stage}` with 7 panels (per observability plan in tech spec)
   - EMF custom metrics: `WeatherCacheHit/Miss`, `ImageCacheHit/Miss/ImageGenerationCount`, `ProviderSuccess/Error`, `BedrockLatency`, `BedrockThrottled`, `LowConfidenceForecast`
   - Alarms: SFN any failure, provider errors >5/5min, orchestrator P99 >25s, Bedrock throttling >3/5min
   - SNS topic for alarm notifications → email
5. Enable X-Ray Active tracing on all Lambda functions and Step Functions (via SST stack transform)
6. Error handling hardening:
   - Graceful degradation: if only 1 provider returns, use it with `low` confidence, emit `LowConfidenceForecast` metric
   - Web: meaningful error card shown on pipeline failure
7. `infra/app-registry.ts` — AWS AppRegistry Application + Resource Group (tag-based: `Application=uweather`, `Stage={stage}`)

### Verification

- Run 10+ test requests across both surfaces
- CloudWatch dashboard shows all 7 panels with data
- Simulate provider failure (invalid API key) → alarm fires, email received
- X-Ray trace shows full request path: API Gateway → Orchestrator → Step Functions → Lambdas → Bedrock
- Check no unhandled errors in CloudWatch Logs
- AppRegistry Application visible in AWS console with correct resource group

---

## Phase 6 — Polish + Production Deploy

**Timeline**: Days 19–20
**Goal**: Production-ready deployment with cost validation

### Tasks

1. Code review pass: search for TODO/FIXME, remove debug logging, verify error messages
2. Biome check: `pnpm biome check .` passes with zero errors/warnings
3. TypeScript strict check: `pnpm tsc --noEmit` passes
4. Security review:
   - Verify all secrets are in SST Secrets (not hardcoded)
   - Verify Lambda IAM roles follow least privilege
   - Verify API Gateway has no unintended public routes
5. Deploy to `prod` stage: `pnpm sst deploy --stage prod`
6. Set production Telegram webhook URL
7. Smoke test production: 5 requests across different cities, both surfaces
8. Cost validation: check AWS Cost Explorer after 48 hours, compare to estimate (~$20/month target)

### Verification

- All prod endpoints respond correctly
- Telegram bot works in production
- Web UI loads from production CloudFront URL
- No errors in prod CloudWatch Logs after smoke tests
- Estimated monthly cost aligns with $17–42 range from cost model

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bedrock model access not approved in time | Blocks Phase 3 entirely | Request access on Day 1 |
| Pixazo API reliability or pricing change | Image generation fails / cost spikes | Monitor usage; Stable Diffusion XL on Bedrock available as drop-in fallback |
| Step Functions cold start + Bedrock latency | User waits 20–30s for forecast | Real-time WebSocket progress updates; consider provisioned concurrency later |
| OpenWeatherMap/WeatherAPI rate limits | Provider failures at scale | Cache aggressively (30 min TTL); graceful degradation to 2 or 1 provider |
| Wikidata SPARQL availability | Landmark resolution fails | Bedrock Haiku fallback always active |
| SST v3 breaking changes | Build/deploy failures | Pin SST version in package.json; update deliberately |

---

## Future Phases (Post-MVP)

These are explicitly out of scope for the initial plan but documented for planning:

- **Telegram bot** — grammY webhook, "send loading message → edit with result" UX, `/weather`, `/history`, `/lang` commands
- **Scheduled daily notifications** — EventBridge + SQS fan-out to subscribed users
- **Android app** — React Native or Kotlin, consumes same API
- **Multi-day forecasts** — extend pipeline to handle 3–5 day forecasts
- **Rate limiting** — API Gateway throttling + per-user limits
- **CI/CD** — GitHub Actions: lint + typecheck + deploy on push to main
- **Testing suite** — Vitest for unit/integration, focused on provider normalization + cache logic

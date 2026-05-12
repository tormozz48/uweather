# uweather — Technical Specification

## 1. DynamoDB Table Schemas

### 1.1 WeatherCache

Caches normalized weather data per location. TTL-based expiry (30 minutes).

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `pk` | String | PK | `CACHE#{city_normalized}` |
| `sk` | String | SK | `{date}#{provider}` (e.g. `2026-05-09#openweather`) |
| `data` | Map | — | Normalized `UnifiedWeatherData` object |
| `rawResponse` | String | — | Original provider response (compressed, for debugging) |
| `fetchedAt` | String | — | ISO 8601 timestamp |
| `ttl` | Number | — | Unix epoch seconds, 30 min from fetchedAt |

**Access patterns:**
- Get all provider data for a city+date: `pk = CACHE#{city}`, `sk begins_with {date}`
- Automatic cleanup via DynamoDB TTL

### 1.2 Forecasts

Stores completed forecast results. Supports user history and image reuse.

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `pk` | String | PK | `FORECAST#{forecastId}` (ULID) |
| `sk` | String | SK | `META` |
| `userId` | String | — | Web session ID |
| `city` | String | — | Normalized city name |
| `country` | String | — | Country code |
| `date` | String | — | `YYYY-MM-DD` |
| `timeSlot` | String | — | morning \| afternoon \| evening \| night |
| `language` | String | — | ISO 639-1 language code |
| `weatherSummary` | Map | — | Consensus weather from Agent 1 |
| `funnyText` | String | — | Agent 2 output |
| `imageUrl` | String | — | CloudFront URL to generated image |
| `imageCacheKey` | String | — | Cache key used for image lookup/storage |
| `sourcesUsed` | List | — | Which providers contributed data |
| `createdAt` | String | — | ISO 8601 |

**GSI: UserHistoryIndex**
- PK: `userId`
- SK: `createdAt`
- Projection: ALL
- Purpose: "Show my past forecasts" query

**GSI: ImageCacheIndex**
- PK: `imageCacheKey`
- SK: `createdAt`
- Projection: `imageUrl`, `funnyText`, `weatherSummary`
- Purpose: Look up existing image for same conditions

### 1.3 Users

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `pk` | String | PK | `USER#web#{sessionId}` |
| `sk` | String | SK | `PROFILE` |
| `platform` | String | — | `web` |
| `language` | String | — | Preferred language (ISO 639-1) |
| `city` | String | — | Last used city |
| `country` | String | — | Last used country |
| `createdAt` | String | — | ISO 8601 |
| `lastActiveAt` | String | — | ISO 8601 |

### 1.4 WebSocketConnections

Maps Step Functions execution ARNs to active WebSocket connection IDs for real-time progress push. TTL-based cleanup (10 minutes).

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `pk` | String | PK | `executionArn` |
| `sk` | String | SK | `connectionId` |
| `ttl` | Number | — | Unix epoch seconds, 10 min from connect time |

**Access patterns:**
- Look up all connections for an execution: `pk = {executionArn}` → push progress to each connection
- Automatic cleanup via DynamoDB TTL

## 2. Image Cache Key Strategy

Format: `{city_normalized}:{date}:{timeSlot}:{condition}:{tempBucket}`

### Normalization rules

- **city_normalized**: lowercase, trimmed, diacritics removed (e.g. `münchen` → `munchen`, `Kyiv` → `kyiv`)
- **date**: `YYYY-MM-DD`
- **timeSlot**: Derived from request time in city's timezone
  - `morning`: 05:00–11:59
  - `afternoon`: 12:00–16:59
  - `evening`: 17:00–20:59
  - `night`: 21:00–04:59
- **condition**: Mapped from consensus weather to one of: `sunny`, `partly_cloudy`, `cloudy`, `rain`, `snow`, `thunderstorm`, `fog`, `windy`
- **tempBucket**: Based on consensus temperature in Celsius
  - `freezing`: < 0°C
  - `cold`: 0–10°C
  - `cool`: 10–18°C
  - `mild`: 18–24°C
  - `warm`: 24–30°C
  - `hot`: > 30°C

### Example

`kyiv:2026-05-09:afternoon:sunny:warm` → generates or retrieves a sunny warm afternoon image with Kyiv landmarks.

### S3 key

`images/{imageCacheKey}.png` — e.g. `images/kyiv:2026-05-09:afternoon:sunny:warm.png`

## 3. API Endpoints

All served via API Gateway HTTP API.

### Public API

| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/forecast` | Start pipeline, return execution handle | `city` (required), `lang` (optional, default `en`) |
| GET | `/forecast/status` | Poll pipeline status / get completed result | `executionArn` (required) |
| GET | `/history` | Get past forecasts | `userId` (required), `limit` (optional, default 10) |
| GET | `/health` | Health check | — |

### Response format — `/forecast` (202 Accepted)

Returns immediately with an execution handle the client uses for polling or WebSocket subscription:

```json
{
  "status": "pending",
  "executionArn": "arn:aws:states:eu-west-1:123:execution:ForecastPipeline:kyiv-2026-05-09-uuid",
  "city": "Kyiv",
  "language": "en"
}
```

### Response format — `/forecast/status` (200 OK — complete)

```json
{
  "forecastId": "01J...",
  "city": "Kyiv",
  "country": "UA",
  "date": "2026-05-09",
  "weather": {
    "temperature": 24,
    "feelsLike": 22,
    "condition": "sunny",
    "humidity": 45,
    "windSpeed": 12,
    "windDirection": "NW",
    "precipitation": 0,
    "uvIndex": 7
  },
  "funnyText": "...",
  "imageUrl": "https://d1234.cloudfront.net/images/kyiv:2026-05-09:afternoon:sunny:warm.png",
  "language": "en",
  "createdAt": "2026-05-09T14:30:00Z"
}
```

### Response format — `/forecast/status` (202 Accepted — still running)

```json
{ "status": "pending" }
```

## 4. Step Functions State Machine

```
StartExecution
│
├─ CheckCache (Lambda)
│  ├─ CACHE HIT → NormalizeFromCache
│  └─ CACHE MISS ↓
│
├─ FetchWeather (Parallel)
│  ├─ OpenWeatherLambda
│  ├─ WeatherAPILambda
│  └─ OpenMeteoLambda
│  (each writes to WeatherCache; retry 2× on any error, catch into Pass so parallel can complete)
│
├─ NormalizeFromFetch (Pass state — merge parallel outputs into flat structure)
│
├─ Agent1_Compare (Lambda → Bedrock Haiku)
│  └─ Output: ConsensusForecast
│
├─ ResolveLandmark (Lambda → Wikidata SPARQL + Bedrock Haiku fallback)
│  └─ Output: landmark names for the city (injected into Agent 2 prompt)
│
├─ ParallelAgents (Parallel — runs Agent2 and image cache lookup concurrently)
│  ├─ Branch A: Agent2_FunnyText (Lambda → Bedrock Haiku)
│  │  └─ Output: localized funny text
│  └─ Branch B: CheckImageCache (Lambda)
│     ├─ IMAGE CACHE HIT → NormalizeImageFromCache
│     └─ IMAGE CACHE MISS → Agent3_ImageGen (Lambda → Pixazo SDXL API → S3)
│        └─ Output: CloudFront image URL
│
├─ NormalizeParallelResults (Pass state — merge funny text + image URL)
│
├─ SaveForecast (Lambda → DynamoDB Forecasts table)
│
└─ PipelineSuccess (Pass state — signals completion)
```

### Real-time progress events

Each Lambda emits a `StageProgress` event to EventBridge (`uweather.pipeline` source) on start and completion. A dedicated `wsPushStage` Lambda receives these events plus built-in Step Functions status events (SUCCEEDED, FAILED, TIMED_OUT) and pushes them to all connected WebSocket clients via the `WebSocketConnections` table.

### Error handling

- Each weather provider: retry 2× with exponential backoff, then continue with remaining providers (minimum 2 of 3 must succeed)
- Bedrock calls: retry 2× on ThrottlingException only, fail on other errors
- ResolveLandmark: retry 1× on any error, fall back to generic landmark if Wikidata fails
- Pixazo (image gen): retry 2× with backoff
- Individual Lambda timeout: 30–90 seconds depending on function
- Full pipeline timeout: 300 seconds
- On failure: Step Functions FAILED event triggers WebSocket push to client

## 5. AI Agent Prompt Design

All prompt templates live in `packages/core/src/prompts/`. Each is a TypeScript function that returns a structured prompt string.

### Agent 1: Weather Comparison

**Input**: Array of `UnifiedWeatherData` from 2–3 providers
**Output**: Single `ConsensusForecast` JSON

System prompt focus: Compare numeric values across providers, compute weighted averages (equal weight by default), flag significant disagreements (>5°C temp difference, conflicting conditions), produce a single consensus forecast.

### ResolveLandmark

**Input**: City name, country code
**Output**: Array of 3–5 landmark names

Primary: Wikidata SPARQL query for well-known places in the city. Fallback: Bedrock Haiku prompt listing notable landmarks. Result injected into Agent 2's prompt.

### Agent 2: Funny Text

**Input**: `ConsensusForecast`, city name, country, language code, landmark names, recent forecast history for this city (last 5, to avoid repetition)
**Output**: String (2–3 paragraphs)

System prompt focus: Write a humorous weather report referencing the provided landmarks and cultural facts. Translate to the requested language. Avoid repeating landmarks from recent history. Include practical recommendations (what to wear, whether to carry an umbrella). Tone: friendly, witty, informative.

### Agent 3: Image Generation

**Input**: `ConsensusForecast`, city name, time of day, landmark names
**Output**: PNG image uploaded to S3, CloudFront URL returned

Uses Pixazo SDXL API (`gateway.pixazo.ai`). Positive prompt: stylized illustration showing the city's recognizable skyline or landmark with current weather conditions. Style: colorful, friendly, slightly cartoonish. Time-of-day lighting. Negative prompt: suppresses photorealism, people, text overlays.

## 6. Core Types

```typescript
interface UnifiedWeatherData {
  provider: 'openweather' | 'weatherapi' | 'open-meteo';
  city: string;
  country: string;
  date: string;                    // YYYY-MM-DD
  fetchedAt: string;               // ISO 8601
  temperature: number;             // Celsius
  feelsLike: number;               // Celsius
  humidity: number;                // percentage 0-100
  windSpeed: number;               // km/h
  windDirection: string;           // cardinal (N, NE, E, etc.)
  condition: WeatherCondition;     // normalized enum
  conditionDescription: string;    // human-readable
  precipitation: number;           // mm
  uvIndex: number;                 // 0-11+
  pressure: number;                // hPa
  visibility: number;              // km
  sunrise: string;                 // ISO 8601
  sunset: string;                  // ISO 8601
}

type WeatherCondition =
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'fog'
  | 'windy';

interface ConsensusForecast extends Omit<UnifiedWeatherData, 'provider' | 'fetchedAt'> {
  confidence: 'high' | 'medium' | 'low';  // based on provider agreement
  providerCount: number;
  disagreements: string[];                  // human-readable list of disagreements
}
```

### Pipeline stage types (real-time progress)

```typescript
type PipelineStageId =
  | 'cache'
  | 'fetch_openweather'
  | 'fetch_weatherapi'
  | 'fetch_openmeteo'
  | 'compare'
  | 'landmark'
  | 'text'
  | 'image_cache'
  | 'image_gen'
  | 'save';

interface StageProgressMessage {
  stageId: PipelineStageId;
  status: 'started' | 'completed' | 'failed';
  executionArn: string;
  timestamp: string;  // ISO 8601
}

// Frontend mapping — raw stages collapsed into 7 visual groups
const VISUAL_STAGES = {
  weather: ['cache', 'fetch_openweather', 'fetch_weatherapi', 'fetch_openmeteo'],
  compare: ['compare'],
  landmark: ['landmark'],
  text: ['text'],
  image: ['image_cache', 'image_gen'],
  save: ['save'],
};
```

## 7. Observability Plan

### Structured Log Format

Every Lambda log entry includes:

```json
{
  "level": "INFO",
  "timestamp": "2026-05-09T14:30:00.123Z",
  "service": "uweather",
  "function": "provider-openweather",
  "requestId": "abc-123",
  "correlationId": "xyz-789",
  "city": "kyiv",
  "duration_ms": 234,
  "message": "Weather data fetched successfully"
}
```

### Custom CloudWatch Metrics (EMF)

| Metric | Unit | Dimensions |
|--------|------|------------|
| `WeatherCacheHit` / `WeatherCacheMiss` | Count | — |
| `ImageCacheHit` / `ImageCacheMiss` / `ImageGenerationCount` | Count | — |
| `ProviderSuccess` / `ProviderError` | Count | provider |
| `BedrockLatency` | Milliseconds | agent |
| `BedrockThrottled` | Count | agent |
| `LowConfidenceForecast` | Count | — |
| `ProviderCount` | Count | — |

### Dashboard Panels

Single CloudWatch dashboard `uweather-{stage}`:

1. Step Functions executions (succeeded, failed, throttled)
2. Weather cache hit/miss counts (time series)
3. Image cache hit/miss/generated counts (time series)
4. Provider reliability — success/error per provider
5. Bedrock latency — P50/P95 per agent (compare, funny-text)
6. Bedrock throttling + forecast quality (LowConfidenceForecast count)
7. API Gateway errors (4xx / 5xx / total requests)

### Alarms

| Alarm | Threshold | Action |
|-------|-----------|--------|
| SFN ExecutionsFailed | ≥ 1 in evaluation period | SNS → Email |
| ProviderError | > 5 errors in 5 min | SNS → Email |
| OrchestratorDuration (P99) | > 25 seconds | SNS → Email |
| BedrockThrottling | > 3 events in 5 min | SNS → Email |

### X-Ray Tracing

Enabled on all Lambda functions (Active mode) and the Step Functions state machine. Traces full request path from API Gateway → Orchestrator → Step Functions → individual Lambdas → Bedrock API calls.

### CloudWatch Log Retention

All Lambda log groups: 30-day retention. Step Functions execution logs (ERROR level): 30-day retention.

## 8. Cost Model (MVP, ~500 requests/day)

| Service | Monthly Estimate | Notes |
|---------|-----------------|-------|
| Lambda | ~$0 | Free tier (1M req/mo) |
| API Gateway | ~$0.50 | HTTP API + WebSocket API |
| Step Functions | ~$0.75 | Standard workflows |
| DynamoDB | ~$2–5 | On-demand, 4 tables |
| Bedrock Haiku (text) | ~$3–5 | 2 calls × 500/day (compare + landmark fallback) |
| Pixazo SDXL (images) | Depends on cache hit rate | External API pricing |
| S3 | ~$0.50 | Image storage |
| CloudFront | ~$1 | Image delivery |
| CloudWatch | ~$3–5 | Logs, metrics, dashboard |
| X-Ray | ~$1 | Traces |
| **Total** | **~$17–42/month** | Image cache hit rate is the main lever |

Target: 80%+ image cache hit rate → monthly cost ~$20.

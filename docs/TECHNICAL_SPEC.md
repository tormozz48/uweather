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
| `userId` | String | — | Telegram chatId or web sessionId |
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
| `pk` | String | PK | `USER#{platform}#{platformId}` (e.g. `USER#telegram#123456`) |
| `sk` | String | SK | `PROFILE` |
| `platform` | String | — | telegram \| web |
| `chatId` | String | — | Telegram chat ID (null for web) |
| `language` | String | — | Preferred language (ISO 639-1) |
| `city` | String | — | Last used city |
| `country` | String | — | Last used country |
| `createdAt` | String | — | ISO 8601 |
| `lastActiveAt` | String | — | ISO 8601 |

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
| GET | `/forecast` | Get today's forecast | `city` (required), `lang` (optional, default `en`) |
| GET | `/history` | Get past forecasts | `userId` (required), `limit` (optional, default 10) |
| GET | `/health` | Health check | — |

### Internal (Telegram webhook)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/telegram/webhook` | Telegram bot webhook endpoint |

### Response format (forecast)

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

## 4. Step Functions State Machine

```
StartExecution
│
├─ CheckCache (Lambda)
│  ├─ CACHE HIT → SkipToAgents
│  └─ CACHE MISS ↓
│
├─ FetchWeather (Parallel)
│  ├─ OpenWeatherLambda
│  ├─ WeatherAPILambda
│  └─ OpenMeteoLambda
│  (each writes to WeatherCache, has individual error handling + retry)
│
├─ NormalizeAndMerge (Pass state — combine outputs)
│
├─ Agent1_Compare (Lambda → Bedrock Haiku)
│  └─ Output: UnifiedForecast
│
├─ Agent2_FunnyText (Lambda → Bedrock Haiku)
│  └─ Output: localized funny text
│
├─ CheckImageCache (Lambda)
│  ├─ IMAGE CACHE HIT → SkipImageGen
│  └─ IMAGE CACHE MISS ↓
│
├─ Agent3_ImageGen (Lambda → Bedrock Titan)
│  └─ Output: S3 image URL
│
├─ SaveForecast (Lambda → DynamoDB Forecasts table)
│
└─ SendResponse (Lambda → Telegram API or API response)
```

### Error handling

- Each weather provider: retry 2× with exponential backoff, then continue with remaining providers (minimum 2 of 3 must succeed)
- Bedrock calls: retry 2× on throttling (429), fail on other errors
- Individual Lambda timeout: 90 seconds (Bedrock calls can be slow)
- Full pipeline timeout: 120 seconds
- On failure: send user-friendly error message, log full error context

## 5. AI Agent Prompt Design

All prompts live in `packages/core/src/prompts/`. Each is a TypeScript function that returns a structured prompt.

### Agent 1: Weather Comparison

**Input**: Array of `UnifiedWeatherData` from 2–3 providers
**Output**: Single `ConsensusForecast` JSON

System prompt focus: Compare numeric values across providers, compute weighted averages (weight by historical accuracy if available, else equal), flag significant disagreements (>5°C temp difference, conflicting conditions), produce a single consensus forecast.

### Agent 2: Funny Text

**Input**: `ConsensusForecast`, city name, country, language code, recent forecast history for this city (last 5, to avoid repetition)
**Output**: String (2–3 paragraphs)

System prompt focus: Write a humorous weather report referencing local landmarks, cultural facts, or seasonal events for the user's city. Translate to the requested language. Avoid repeating facts/landmarks from recent history. Include practical recommendations (what to wear, whether to carry an umbrella). Tone: friendly, witty, informative.

### Agent 3: Image Generation

**Input**: `ConsensusForecast`, city name, time of day
**Output**: Base64 image (PNG)

Prompt focus: Generate a stylized illustration showing the city's recognizable skyline or landmark with the current weather conditions. Style: colorful, friendly, slightly cartoonish. Include visual weather indicators (sun, clouds, rain, etc.). Time-of-day lighting (golden morning, bright afternoon, warm evening, dark night).

## 6. Unified Weather Data Type

```typescript
interface UnifiedWeatherData {
  provider: 'openweather' | 'weatherapi' | 'open-meteo';
  city: string;
  country: string;
  date: string;                    // YYYY-MM-DD
  fetchedAt: string;               // ISO 8601
  temperature: number;             // Celsius
  feelsLike: number;               // Celsius
  humidity: number;                 // percentage 0-100
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
  "userId": "telegram#123456",
  "city": "kyiv",
  "duration_ms": 234,
  "message": "Weather data fetched successfully"
}
```

### Custom CloudWatch Metrics

| Metric | Unit | Dimensions |
|--------|------|------------|
| `WeatherCacheHitRate` | Percent | city |
| `ImageCacheHitRate` | Percent | city |
| `ProviderLatency` | Milliseconds | provider |
| `ProviderErrorRate` | Percent | provider |
| `BedrockLatency` | Milliseconds | model, agent |
| `ForecastE2ELatency` | Milliseconds | — |
| `StepFunctionDuration` | Milliseconds | — |
| `ImageGenerationCount` | Count | — |

### Dashboard Panels

Single CloudWatch dashboard `uweather-{stage}`:

1. Request volume (time series)
2. Cache efficiency — weather + image hit rates (time series)
3. Provider health — 3 panels with latency + error rate
4. AI pipeline — Bedrock latency by agent (time series)
5. End-to-end forecast latency (p50, p90, p99)
6. Error rate (time series)
7. Estimated daily cost (based on invocation counts)

### Alarms

| Alarm | Threshold | Action |
|-------|-----------|--------|
| ProviderErrorRate | > 5% over 5 min | SNS → Email |
| StepFunctionFailureRate | > 1% over 15 min | SNS → Email |
| LambdaDuration | > 75s (of 90s timeout) | SNS → Email |
| BedrockThrottling | > 3 events in 5 min | SNS → Email |

### X-Ray Tracing

Enabled on: API Gateway, all Lambda functions. Traces full request path from API Gateway → Orchestrator → Step Functions → individual Lambdas → Bedrock API calls.

## 8. Cost Model (MVP, ~500 requests/day)

| Service | Monthly Estimate | Notes |
|---------|-----------------|-------|
| Lambda | ~$0 | Free tier (1M req/mo) |
| API Gateway | ~$0.50 | HTTP API pricing |
| Step Functions | ~$0.75 | Standard workflows |
| DynamoDB | ~$2–5 | On-demand, 3 tables |
| Bedrock Haiku (text) | ~$3–5 | 2 calls × 500/day |
| Bedrock Titan (images) | ~$5–24 | Depends on cache hit rate |
| S3 | ~$0.50 | Image storage |
| CloudFront | ~$1 | Image delivery |
| CloudWatch | ~$3–5 | Logs, metrics, dashboard |
| X-Ray | ~$1 | Traces |
| **Total** | **~$17–42/month** | Image cache hit rate is the main lever |

Target: 80%+ image cache hit rate → monthly cost ~$20.

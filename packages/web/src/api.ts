/**
 * API client for uweather backend.
 * Base URL is injected by Vite via VITE_API_URL environment variable.
 */

export interface WeatherSummary {
  temperature: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  uvIndex: number;
}

export interface ForecastResponse {
  forecastId: string;
  city: string;
  country: string;
  date: string;
  weather: WeatherSummary;
  funnyText: string;
  imageUrl: string;
  language: string;
  createdAt: string;
}

export interface HistoryResponse {
  userId: string;
  forecasts: ForecastResponse[];
}

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

/** Shape returned by GET /forecast (HTTP 202 — pipeline started). */
interface ForecastStartResponse {
  status: 'pending';
  executionArn: string;
  city: string;
  language: string;
}

/** Shape returned by GET /forecast/status while the pipeline is running (HTTP 202). */
interface ForecastPendingResponse {
  status: 'pending';
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 20; // 20 × 3 s = 60 s client-side ceiling

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a forecast for the given city.
 *
 * Internally uses the two-step async API:
 *  1. GET /forecast          → 202 { executionArn }
 *  2. GET /forecast/status   → 202 (pending) | 200 ForecastResponse | 500 error
 *
 * Polls step 2 every 3 s until a terminal response arrives.
 * The caller (App.tsx) sees no change — it still gets a Promise<ForecastResponse>.
 */
export async function getForecast(
  city: string,
  lang: string,
  userId: string,
  coords?: { lat: number; lon: number },
): Promise<ForecastResponse> {
  // ── Step 1: start the pipeline ────────────────────────────────────────────
  const startParams = new URLSearchParams({ city, lang, userId });
  if (coords) {
    startParams.set('lat', String(coords.lat));
    startParams.set('lon', String(coords.lon));
  }
  const { executionArn } = await apiFetch<ForecastStartResponse>(`/forecast?${startParams}`);

  // ── Step 2: poll for the result ───────────────────────────────────────────
  const statusParams = new URLSearchParams({ executionArn });

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(`${BASE_URL}/forecast/status?${statusParams}`);

    if (response.status === 202) {
      // Pipeline still running — keep polling
      const body = (await response.json()) as ForecastPendingResponse;
      if (body.status === 'pending') continue;
    }

    if (response.ok) {
      // 200 — pipeline succeeded, full forecast returned
      return response.json() as Promise<ForecastResponse>;
    }

    // 4xx / 5xx — pipeline failed
    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.error ?? body.message ?? `Forecast failed: ${response.status}`);
  }

  throw new Error('Forecast timed out — please try again.');
}

export function getHistory(userId: string, limit = 10): Promise<HistoryResponse> {
  const params = new URLSearchParams({ userId, limit: String(limit) });
  return apiFetch<HistoryResponse>(`/history?${params}`);
}

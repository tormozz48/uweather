/**
 * API client for uweather backend.
 * Base URL is injected by Vite via VITE_API_URL environment variable.
 * WebSocket URL is injected via VITE_WS_URL for real-time pipeline progress.
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
export const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? '';

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
 * Start the forecast pipeline and return the executionArn.
 * The caller is responsible for tracking progress via WebSocket
 * and polling for the final result.
 */
export async function startForecast(
  city: string,
  lang: string,
  userId: string,
  coords?: { lat: number; lon: number },
): Promise<string> {
  const startParams = new URLSearchParams({ city, lang, userId });
  if (coords) {
    startParams.set('lat', String(coords.lat));
    startParams.set('lon', String(coords.lon));
  }
  const { executionArn } = await apiFetch<ForecastStartResponse>(`/forecast?${startParams}`);
  return executionArn;
}

/**
 * Poll for the forecast result. Called after pipeline completes
 * (detected via WebSocket) or as a fallback if WebSocket is unavailable.
 */
export async function pollForecastResult(executionArn: string): Promise<ForecastResponse> {
  const statusParams = new URLSearchParams({ executionArn });

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(`${BASE_URL}/forecast/status?${statusParams}`);

    if (response.status === 202) {
      const body = (await response.json()) as ForecastPendingResponse;
      if (body.status === 'pending') continue;
    }

    if (response.ok) {
      return response.json() as Promise<ForecastResponse>;
    }

    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.error ?? body.message ?? `Forecast failed: ${response.status}`);
  }

  throw new Error('Forecast timed out — please try again.');
}

/**
 * Fetch a forecast — high-level API that combines start + poll.
 * Used as fallback when WebSocket is not available.
 */
export async function getForecast(
  city: string,
  lang: string,
  userId: string,
  coords?: { lat: number; lon: number },
): Promise<ForecastResponse> {
  const executionArn = await startForecast(city, lang, userId, coords);
  return pollForecastResult(executionArn);
}

export function getHistory(userId: string, limit = 10): Promise<HistoryResponse> {
  const params = new URLSearchParams({ userId, limit: String(limit) });
  return apiFetch<HistoryResponse>(`/history?${params}`);
}

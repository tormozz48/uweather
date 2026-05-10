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

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getForecast(
  city: string,
  lang: string,
  userId: string,
): Promise<ForecastResponse> {
  const params = new URLSearchParams({ city, lang, userId });
  return apiFetch<ForecastResponse>(`/forecast?${params}`);
}

export async function getHistory(userId: string, limit = 10): Promise<HistoryResponse> {
  const params = new URLSearchParams({ userId, limit: String(limit) });
  return apiFetch<HistoryResponse>(`/history?${params}`);
}

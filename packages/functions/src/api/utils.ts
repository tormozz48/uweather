import type { ForecastResponse, ForecastResult } from '@uweather/core';
import { forecastService } from '../services/index.js';

/**
 * Shared utilities for API Lambda handlers.
 *
 * Exports:
 *  - toForecastResponse  — ForecastResult → ForecastResponse shape
 *  - fetchForecastById   — load a ForecastResult from DynamoDB by forecastId
 *  - jsonOk              — 200 JSON response helper
 *  - jsonBadRequest      — 400 JSON response helper
 *  - jsonServerError     — 5xx JSON response helper
 */

// ── Data mappers ──────────────────────────────────────────────────────────────

/** Map a stored ForecastResult to the public API response shape. */
export function toForecastResponse(forecast: ForecastResult): ForecastResponse {
  const w = forecast.weatherSummary;
  return {
    forecastId: forecast.forecastId,
    city: forecast.city,
    country: forecast.country,
    date: forecast.date,
    weather: {
      temperature: w.temperature,
      feelsLike: w.feelsLike,
      condition: w.condition,
      humidity: w.humidity,
      windSpeed: w.windSpeed,
      windDirection: w.windDirection,
      precipitation: w.precipitation,
      uvIndex: w.uvIndex,
    },
    funnyText: forecast.funnyText,
    imageUrl: forecast.imageUrl,
    language: forecast.language,
    createdAt: forecast.createdAt,
  };
}

/** Fetch a complete ForecastResult from DynamoDB by forecastId. */
export function fetchForecastById(forecastId: string): Promise<ForecastResult> {
  return forecastService.getById(forecastId);
}

// ── HTTP response helpers ─────────────────────────────────────────────────────

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export function jsonOk<T>(body: T) {
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  } as const;
}

export function jsonAccepted<T>(body: T) {
  return {
    statusCode: 202,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  } as const;
}

export function jsonBadRequest(error: string) {
  return {
    statusCode: 400,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error }),
  } as const;
}

export function jsonServerError(statusCode: 500 | 504, error: string, message: string) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error, message }),
  } as const;
}

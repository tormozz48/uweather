import { transformOpenWeather } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';

const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * OpenWeatherMap HTTP client — pure fetch, no AWS/SST dependencies.
 * Used by the Lambda handler and by integration tests.
 *
 * When lat/lon are provided, queries by coordinates (no city-name ambiguity).
 * Falls back to the city-string `?q=` endpoint when coordinates are absent.
 */
export async function fetchOpenWeather(
  city: string,
  apiKey: string,
  coords?: { lat: number; lon: number },
): Promise<UnifiedWeatherData> {
  const baseParams = `appid=${apiKey}&units=metric`;
  const locationParam = coords
    ? `lat=${coords.lat}&lon=${coords.lon}`
    : `q=${encodeURIComponent(city)}`;

  const url = `${BASE_URL}?${locationParam}&${baseParams}`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenWeatherMap API error ${response.status}: ${body}`);
  }

  const raw: unknown = await response.json();
  return transformOpenWeather(raw);
}

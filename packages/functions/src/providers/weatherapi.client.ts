import { transformWeatherAPI } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';

const BASE_URL = 'https://api.weatherapi.com/v1/current.json';

/**
 * WeatherAPI HTTP client — pure fetch, no AWS/SST dependencies.
 * Used by the Lambda handler and by integration tests.
 *
 * When lat/lon are provided, queries as "lat,lon" — WeatherAPI's supported
 * format for coordinate-based lookup, bypassing city-name disambiguation.
 * Falls back to the city-string `?q=` endpoint when coordinates are absent.
 */
export async function fetchWeatherAPI(
  city: string,
  apiKey: string,
  coords?: { lat: number; lon: number },
): Promise<UnifiedWeatherData> {
  const q = coords ? `${coords.lat},${coords.lon}` : city;
  const url = `${BASE_URL}?key=${apiKey}&q=${encodeURIComponent(q)}&aqi=no`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeatherAPI error ${response.status}: ${body}`);
  }

  const raw: unknown = await response.json();
  return transformWeatherAPI(raw);
}

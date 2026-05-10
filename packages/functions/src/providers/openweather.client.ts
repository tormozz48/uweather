import { transformOpenWeather } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';

const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * OpenWeatherMap HTTP client — pure fetch, no AWS/SST dependencies.
 * Used by the Lambda handler and by integration tests.
 */
export async function fetchOpenWeather(city: string, apiKey: string): Promise<UnifiedWeatherData> {
  const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenWeatherMap API error ${response.status}: ${body}`);
  }

  const raw: unknown = await response.json();
  return transformOpenWeather(raw);
}

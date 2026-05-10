import { transformWeatherAPI } from '@uweather/core';
import type { UnifiedWeatherData } from '@uweather/core';

const BASE_URL = 'https://api.weatherapi.com/v1/current.json';

/**
 * WeatherAPI HTTP client — pure fetch, no AWS/SST dependencies.
 * Used by the Lambda handler and by integration tests.
 */
export async function fetchWeatherAPI(city: string, apiKey: string): Promise<UnifiedWeatherData> {
  const url = `${BASE_URL}?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeatherAPI error ${response.status}: ${body}`);
  }

  const raw: unknown = await response.json();
  return transformWeatherAPI(raw);
}

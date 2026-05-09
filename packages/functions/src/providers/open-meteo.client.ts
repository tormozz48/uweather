/**
 * Open-Meteo HTTP client — pure fetch, no API key, no AWS/SST dependencies.
 * Two-step: geocoding API → forecast API.
 * Used by the Lambda handler and by integration tests.
 */
import { transformOpenMeteo } from '@uweather/core';
import type { OMGeocodingResponse, OMWeatherResponse, UnifiedWeatherData } from '@uweather/core';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_PARAMS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'visibility',
  'is_day',
].join(',');

const DAILY_PARAMS = ['sunrise', 'sunset', 'uv_index_max'].join(',');

export async function fetchOpenMeteo(city: string): Promise<UnifiedWeatherData> {
  // Step 1: Geocode the city name to lat/lon
  const geoUrl = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const geoResponse = await fetch(geoUrl);
  if (!geoResponse.ok) {
    throw new Error(`Open-Meteo geocoding error ${geoResponse.status}`);
  }

  const geoData = (await geoResponse.json()) as OMGeocodingResponse;
  const geoResult = geoData.results?.[0];
  if (!geoResult) {
    throw new Error(`Open-Meteo: city not found — "${city}"`);
  }

  // Step 2: Fetch current weather + daily UV/sunrise/sunset
  const weatherUrl =
    `${FORECAST_URL}` +
    `?latitude=${geoResult.latitude}` +
    `&longitude=${geoResult.longitude}` +
    `&current=${CURRENT_PARAMS}` +
    `&daily=${DAILY_PARAMS}` +
    `&timezone=UTC` +
    `&forecast_days=1`;

  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    throw new Error(`Open-Meteo forecast error ${weatherResponse.status}`);
  }

  const weatherData = (await weatherResponse.json()) as OMWeatherResponse;
  return transformOpenMeteo(geoResult, weatherData);
}

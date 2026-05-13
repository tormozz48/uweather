import { transformOpenMeteo } from '@uweather/core';
import type {
  OMGeocodingResponse,
  OMGeocodingResult,
  OMWeatherResponse,
  UnifiedWeatherData,
} from '@uweather/core';

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

/**
 * Open-Meteo HTTP client — pure fetch, no API key, no AWS/SST dependencies.
 *
 * When lat/lon are provided (from the client's geocoding selection), the
 * geocoding step is skipped entirely and we go straight to the forecast API.
 * This avoids re-geocoding and eliminates any city-name ambiguity.
 *
 * Without coordinates, falls back to the original two-step flow:
 *   1. Geocoding API (name → lat/lon)
 *   2. Forecast API (lat/lon → weather)
 */
export async function fetchOpenMeteo(
  city: string,
  coords?: { lat: number; lon: number },
): Promise<UnifiedWeatherData> {
  let geoResult: OMGeocodingResult;

  if (coords) {
    // Coordinates already known — skip geocoding, use a minimal stub for the
    // transformer (city/country come from UnifiedWeatherData returned by the API).
    geoResult = {
      id: 0,
      latitude: coords.lat,
      longitude: coords.lon,
      name: city,
      country: '',
      country_code: '',
    };
  } else {
    // Step 1: Geocode the city name to lat/lon
    const geoUrl = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geoUrl);
    if (!geoResponse.ok) {
      throw new Error(`Open-Meteo geocoding error ${geoResponse.status}`);
    }

    const geoData = (await geoResponse.json()) as OMGeocodingResponse;
    const result = geoData.results?.[0];
    if (!result) {
      throw new Error(`Open-Meteo: city not found — "${city}"`);
    }
    geoResult = result;
  }

  // Step 2: Fetch current weather + daily UV/sunrise/sunset
  const weatherUrl = `${FORECAST_URL}?latitude=${geoResult.latitude}&longitude=${geoResult.longitude}&current=${CURRENT_PARAMS}&daily=${DAILY_PARAMS}&timezone=UTC&forecast_days=1`;

  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    throw new Error(`Open-Meteo forecast error ${weatherResponse.status}`);
  }

  const weatherData = (await weatherResponse.json()) as OMWeatherResponse;
  return transformOpenMeteo(geoResult, weatherData);
}

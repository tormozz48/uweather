/**
 * Open-Meteo weather response transformer.
 *
 * Two-step fetch required:
 *   1. Geocoding: GET https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1
 *   2. Forecast: GET https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...
 *      &current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,
 *        weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,visibility,is_day
 *      &daily=sunrise,sunset,uv_index_max
 *      &timezone=UTC&forecast_days=1
 *
 * No API key required. timezone=UTC keeps all timestamps in UTC.
 */
import type { UnifiedWeatherData, WeatherCondition } from '../types/weather.js';
import { toDateString } from '../utils/time.js';

// ── Internal API response types ──────────────────────────────────────────────

export interface OMGeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  country: string;
}

export interface OMGeocodingResponse {
  results?: OMGeocodingResult[];
}

export interface OMWeatherResponse {
  current: {
    time: string; // ISO 8601 datetime (UTC, no trailing Z)
    temperature_2m: number; // Celsius
    relative_humidity_2m: number; // %
    apparent_temperature: number; // Celsius
    precipitation: number; // mm
    weather_code: number; // WMO code
    surface_pressure: number; // hPa
    wind_speed_10m: number; // km/h
    wind_direction_10m: number; // degrees
    visibility: number; // meters
    is_day: number; // 0 = night, 1 = day
  };
  daily: {
    time: string[];
    sunrise: string[]; // ISO 8601 datetime (UTC)
    sunset: string[]; // ISO 8601 datetime (UTC)
    uv_index_max: number[];
  };
}

// ── WMO weather code mappings ─────────────────────────────────────────────────
// Full reference: https://open-meteo.com/en/docs#weathervariables

function mapWMOCondition(code: number, isDay: number): WeatherCondition {
  if (code === 0) return isDay ? 'sunny' : 'partly_cloudy'; // Clear sky
  if (code === 1) return 'partly_cloudy'; // Mainly clear
  if (code === 2) return 'partly_cloudy'; // Partly cloudy
  if (code === 3) return 'cloudy'; // Overcast
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain'; // Drizzle + rain + freezing variants
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain'; // Rain showers
  if (code === 85 || code === 86) return 'snow'; // Snow showers
  if (code === 95 || code === 96 || code === 99) return 'thunderstorm';
  return 'cloudy';
}

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

// ── Shared utility ────────────────────────────────────────────────────────────

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8] ?? 'N';
}

/**
 * Open-Meteo returns ISO datetime strings without timezone suffix when timezone=UTC.
 * e.g. "2026-05-09T03:30" → "2026-05-09T03:30:00Z"
 */
function toUTCIso(dateTimeStr: string): string {
  // Already has seconds? e.g. "2026-05-09T03:30:00" → append Z
  // Only hours:minutes? e.g. "2026-05-09T03:30" → append :00Z
  if (/T\d{2}:\d{2}:\d{2}$/.test(dateTimeStr)) return `${dateTimeStr}Z`;
  if (/T\d{2}:\d{2}$/.test(dateTimeStr)) return `${dateTimeStr}:00Z`;
  return dateTimeStr; // Unknown format — return as-is
}

// ── Transformer ───────────────────────────────────────────────────────────────

export function transformOpenMeteo(
  geoResult: OMGeocodingResult,
  weather: OMWeatherResponse,
): UnifiedWeatherData {
  const now = new Date();
  const current = weather.current;
  const daily = weather.daily;

  const date = toDateString(now);
  const sunrise = daily.sunrise[0] ? toUTCIso(daily.sunrise[0]) : `${date}T04:00:00Z`;
  const sunset = daily.sunset[0] ? toUTCIso(daily.sunset[0]) : `${date}T19:00:00Z`;

  return {
    provider: 'open-meteo',
    city: geoResult.name,
    country: geoResult.country_code,
    date,
    fetchedAt: now.toISOString(),
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    windDirection: degreesToCardinal(current.wind_direction_10m),
    condition: mapWMOCondition(current.weather_code, current.is_day),
    conditionDescription: WMO_DESCRIPTIONS[current.weather_code] ?? 'Unknown conditions',
    precipitation: current.precipitation,
    uvIndex: daily.uv_index_max[0] ?? 0,
    pressure: current.surface_pressure,
    visibility: Math.round((current.visibility / 1000) * 10) / 10, // m → km
    sunrise,
    sunset,
  };
}

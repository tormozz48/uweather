/**
 * WeatherAPI current weather response transformer.
 * API endpoint: GET /v1/current.json?key={key}&q={city}
 *
 * Note: sunrise/sunset are not available in the current weather endpoint.
 * UTC midnight fallbacks are used; accurate values require the astronomy endpoint
 * (POST /v1/astronomy.json) — deferred to a future phase.
 */
import type { UnifiedWeatherData, WeatherCondition } from '../types/weather.js';
import { toDateString } from '../utils/time.js';

// ── Internal API response types ──────────────────────────────────────────────

interface WACondition {
  text: string;
  icon: string;
  code: number;
}

interface WACurrentResponse {
  location: {
    name: string;
    country: string;
  };
  current: {
    temp_c: number;
    feelslike_c: number;
    condition: WACondition;
    wind_kph: number;
    wind_dir: string; // Cardinal direction already provided, e.g. "NW"
    pressure_mb: number;
    precip_mm: number;
    humidity: number;
    vis_km: number;
    uv: number;
  };
}

// ── Condition mapping ─────────────────────────────────────────────────────────
// Full code list: https://www.weatherapi.com/docs/weather_conditions.json

const RAIN_CODES = new Set([
  1063, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246, 1069, 1072, 1150, 1153,
  1168, 1171, 1204, 1207, 1249, 1252,
]);

const SNOW_CODES = new Set([
  1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1255, 1258, 1261, 1264,
]);

const THUNDERSTORM_CODES = new Set([1087, 1273, 1276, 1279, 1282]);

function mapWACondition(code: number): WeatherCondition {
  if (code === 1000) return 'sunny';
  if (code === 1003) return 'partly_cloudy';
  if (code === 1006 || code === 1009) return 'cloudy';
  if (code === 1030 || code === 1135 || code === 1147) return 'fog';
  if (THUNDERSTORM_CODES.has(code)) return 'thunderstorm';
  if (SNOW_CODES.has(code)) return 'snow';
  if (RAIN_CODES.has(code)) return 'rain';
  return 'cloudy'; // Fallback for unknown codes
}

// ── Transformer ───────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: raw API response shape is validated at runtime
export function transformWeatherAPI(raw: any): UnifiedWeatherData {
  const response = raw as WACurrentResponse;
  const now = new Date();
  const date = toDateString(now);

  return {
    provider: 'weatherapi',
    city: response.location.name,
    country: response.location.country,
    date,
    fetchedAt: now.toISOString(),
    temperature: response.current.temp_c,
    feelsLike: response.current.feelslike_c,
    humidity: response.current.humidity,
    windSpeed: response.current.wind_kph,
    windDirection: response.current.wind_dir,
    condition: mapWACondition(response.current.condition.code),
    conditionDescription: response.current.condition.text,
    precipitation: response.current.precip_mm,
    uvIndex: response.current.uv,
    pressure: response.current.pressure_mb,
    visibility: response.current.vis_km,
    // Fallback values — astronomy endpoint is not called in this phase
    sunrise: `${date}T04:00:00Z`,
    sunset: `${date}T19:00:00Z`,
  };
}

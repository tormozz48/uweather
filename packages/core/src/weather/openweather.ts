/**
 * OpenWeatherMap current weather API response transformer.
 * API endpoint: GET /data/2.5/weather?q={city}&appid={key}&units=metric
 */
import type { UnifiedWeatherData, WeatherCondition } from '../types/weather.js';
import { toDateString } from '../utils/time.js';

// ── Internal API response types ──────────────────────────────────────────────

interface OWMWeatherItem {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface OWMResponse {
  weather: OWMWeatherItem[];
  main: {
    temp: number; // Celsius (units=metric)
    feels_like: number; // Celsius
    pressure: number; // hPa
    humidity: number; // %
  };
  visibility?: number; // meters, max 10000
  wind: {
    speed: number; // m/s (units=metric)
    deg: number; // degrees 0-360
  };
  rain?: { '1h'?: number; '3h'?: number }; // mm
  snow?: { '1h'?: number; '3h'?: number }; // mm
  sys: {
    country: string;
    sunrise: number; // Unix timestamp
    sunset: number; // Unix timestamp
  };
  name: string;
  timezone: number; // UTC offset in seconds
}

// ── Condition mapping ─────────────────────────────────────────────────────────

function mapOWMCondition(weatherId: number): WeatherCondition {
  if (weatherId >= 200 && weatherId < 300) return 'thunderstorm';
  if (weatherId >= 300 && weatherId < 400) return 'rain'; // Drizzle
  if (weatherId >= 500 && weatherId < 600) return 'rain';
  if (weatherId >= 600 && weatherId < 700) return 'snow';
  if (weatherId === 701 || weatherId === 741) return 'fog';
  if (weatherId === 771 || weatherId === 781) return 'windy'; // Squalls / tornado
  if (weatherId >= 700 && weatherId < 800) return 'fog'; // Smoke, haze, dust, mist
  if (weatherId === 800) return 'sunny';
  if (weatherId === 801 || weatherId === 802) return 'partly_cloudy'; // Few / scattered clouds
  if (weatherId >= 803) return 'cloudy'; // Broken / overcast
  return 'cloudy';
}

// ── Shared utility ────────────────────────────────────────────────────────────

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8] ?? 'N';
}

// ── Transformer ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformOpenWeather(raw: any): UnifiedWeatherData {
  const response = raw as OWMResponse;
  const weatherItem = response.weather[0];
  if (!weatherItem) throw new Error('OpenWeatherMap response missing weather array');

  const now = new Date();
  const precipitation = response.rain?.['1h'] ?? response.snow?.['1h'] ?? 0;

  return {
    provider: 'openweather',
    city: response.name,
    country: response.sys.country,
    date: toDateString(now),
    fetchedAt: now.toISOString(),
    temperature: Math.round(response.main.temp * 10) / 10,
    feelsLike: Math.round(response.main.feels_like * 10) / 10,
    humidity: response.main.humidity,
    windSpeed: Math.round(response.wind.speed * 3.6 * 10) / 10, // m/s → km/h
    windDirection: degreesToCardinal(response.wind.deg),
    condition: mapOWMCondition(weatherItem.id),
    conditionDescription: weatherItem.description,
    precipitation,
    uvIndex: 0, // Not available in free-tier current weather endpoint
    pressure: response.main.pressure,
    visibility: Math.round(((response.visibility ?? 10000) / 1000) * 10) / 10, // m → km
    sunrise: new Date(response.sys.sunrise * 1000).toISOString(),
    sunset: new Date(response.sys.sunset * 1000).toISOString(),
  };
}

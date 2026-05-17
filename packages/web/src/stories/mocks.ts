/**
 * Shared mock data for Storybook stories.
 * Centralises realistic fixtures so every story stays consistent.
 */
import type { ForecastResponse } from '../api.ts';

export const MOCK_FORECAST: ForecastResponse = {
  forecastId: 'fc-abc-123',
  city: 'Kyiv',
  country: 'Ukraine',
  date: '2026-05-16',
  weather: {
    temperature: 24,
    feelsLike: 22,
    condition: 'partly_cloudy',
    humidity: 55,
    windSpeed: 12,
    windDirection: 'NW',
    precipitation: 0,
    uvIndex: 6,
  },
  funnyText:
    'The clouds are having a meeting above Kyiv today, but they forgot the agenda.\n\nExpect 24 degrees of "I should probably bring a jacket but I won\'t" energy.\n\nThe wind from the northwest is blowing at 12 km/h, just enough to mess up your hair but not enough to blame it on.',
  imageUrl: 'https://placehold.co/800x450/1a1d27/4f8ef7?text=Kyiv+%E2%9B%85',
  language: 'en',
  createdAt: '2026-05-16T10:30:00Z',
};

export const MOCK_FORECAST_RAIN: ForecastResponse = {
  forecastId: 'fc-def-456',
  city: 'London',
  country: 'United Kingdom',
  date: '2026-05-15',
  weather: {
    temperature: 13,
    feelsLike: 10,
    condition: 'rain',
    humidity: 88,
    windSpeed: 25,
    windDirection: 'SW',
    precipitation: 4.2,
    uvIndex: 0,
  },
  funnyText:
    'London is doing its signature move again: rain.\n\nAt 13 degrees with 88% humidity, the air is basically a warm bath you did not ask for.',
  imageUrl: 'https://placehold.co/800x450/1a1d27/4f8ef7?text=London+%F0%9F%8C%A7',
  language: 'en',
  createdAt: '2026-05-15T14:00:00Z',
};

export const MOCK_FORECAST_SNOW: ForecastResponse = {
  forecastId: 'fc-ghi-789',
  city: 'Tokyo',
  country: 'Japan',
  date: '2026-01-20',
  weather: {
    temperature: -2,
    feelsLike: -7,
    condition: 'snow',
    humidity: 72,
    windSpeed: 18,
    windDirection: 'N',
    precipitation: 8.5,
    uvIndex: 0,
  },
  funnyText:
    'Tokyo woke up and chose ❄️.\n\nAt minus 2 degrees, even the vending machines are shivering.',
  imageUrl: 'https://placehold.co/800x450/1a1d27/4f8ef7?text=Tokyo+%E2%9D%84',
  language: 'en',
  createdAt: '2026-01-20T08:00:00Z',
};

export const MOCK_HISTORY: ForecastResponse[] = [
  MOCK_FORECAST,
  MOCK_FORECAST_RAIN,
  MOCK_FORECAST_SNOW,
];

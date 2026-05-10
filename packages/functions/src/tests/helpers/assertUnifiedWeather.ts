import type { UnifiedWeatherData, WeatherCondition } from '@uweather/core';
/**
 * Shared assertion helper for UnifiedWeatherData.
 * Validates field types, enum membership, and value ranges.
 */
import { expect } from 'vitest';

const VALID_CONDITIONS: WeatherCondition[] = [
  'sunny',
  'partly_cloudy',
  'cloudy',
  'rain',
  'snow',
  'thunderstorm',
  'fog',
  'windy',
];

const VALID_WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function assertUnifiedWeather(
  data: UnifiedWeatherData,
  expectedProvider: UnifiedWeatherData['provider'],
): void {
  // Provider
  expect(data.provider).toBe(expectedProvider);

  // Strings
  expect(typeof data.city).toBe('string');
  expect(data.city.length).toBeGreaterThan(0);

  expect(typeof data.country).toBe('string');
  expect(data.country.length).toBeGreaterThan(0);

  // Date fields
  expect(data.date).toMatch(ISO_DATE_RE);
  expect(data.fetchedAt).toMatch(ISO_DATETIME_RE);
  expect(data.sunrise).toMatch(ISO_DATETIME_RE);
  expect(data.sunset).toMatch(ISO_DATETIME_RE);

  // Sunrise must be before sunset
  expect(new Date(data.sunrise).getTime()).toBeLessThan(new Date(data.sunset).getTime());

  // Temperature: plausible Earth range
  expect(data.temperature).toBeGreaterThan(-90);
  expect(data.temperature).toBeLessThan(60);

  expect(data.feelsLike).toBeGreaterThan(-90);
  expect(data.feelsLike).toBeLessThan(70);

  // Humidity: 0-100%
  expect(data.humidity).toBeGreaterThanOrEqual(0);
  expect(data.humidity).toBeLessThanOrEqual(100);

  // Wind
  expect(data.windSpeed).toBeGreaterThanOrEqual(0);
  expect(VALID_WIND_DIRECTIONS).toContain(data.windDirection);

  // Condition enum
  expect(VALID_CONDITIONS).toContain(data.condition);

  // Description
  expect(typeof data.conditionDescription).toBe('string');
  expect(data.conditionDescription.length).toBeGreaterThan(0);

  // Precipitation: non-negative
  expect(data.precipitation).toBeGreaterThanOrEqual(0);

  // UV index: 0–20 reasonable cap
  expect(data.uvIndex).toBeGreaterThanOrEqual(0);
  expect(data.uvIndex).toBeLessThan(20);

  // Pressure: sea-level range is roughly 870–1084 hPa
  expect(data.pressure).toBeGreaterThan(800);
  expect(data.pressure).toBeLessThan(1100);

  // Visibility: 0–100 km
  expect(data.visibility).toBeGreaterThanOrEqual(0);
  expect(data.visibility).toBeLessThanOrEqual(100);
}

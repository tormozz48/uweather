/**
 * Integration test — WeatherAPI provider.
 *
 * Requires: packages/functions/.env.test
 *   WEATHERAPI_KEY=<your key>
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fetchWeatherAPI } from './weatherapi.client.js';
import { assertUnifiedWeather } from '../tests/helpers/assertUnifiedWeather.js';

const TEST_CITY = 'London';

describe('fetchWeatherAPI (integration)', () => {
  let apiKey: string;

  beforeAll(() => {
    apiKey = process.env.WEATHERAPI_KEY ?? '';
    if (!apiKey) {
      throw new Error(
        'WEATHERAPI_KEY is not set.\n' +
          'Create packages/functions/.env.test with WEATHERAPI_KEY=<your key>.',
      );
    }
  });

  it('returns a valid UnifiedWeatherData for a known city', async () => {
    const data = await fetchWeatherAPI(TEST_CITY, apiKey);

    assertUnifiedWeather(data, 'weatherapi');

    // WeatherAPI returns the canonical city name
    expect(data.city.toLowerCase()).toContain('london');
    expect(data.country.toLowerCase()).toContain('united kingdom');
  });

  it('throws on an unknown city', async () => {
    await expect(
      fetchWeatherAPI('ThisCityDefinitelyDoesNotExist_XYZ123', apiKey),
    ).rejects.toThrow(/WeatherAPI error/);
  });

  it('throws on an invalid API key', async () => {
    await expect(fetchWeatherAPI(TEST_CITY, 'invalid_key')).rejects.toThrow(
      /WeatherAPI error 401/,
    );
  });
});

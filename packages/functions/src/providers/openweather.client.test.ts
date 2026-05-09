/**
 * Integration test — OpenWeatherMap provider.
 *
 * Requires: packages/functions/.env.test
 *   OPENWEATHER_API_KEY=<your key>
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fetchOpenWeather } from './openweather.client.js';
import { assertUnifiedWeather } from '../tests/helpers/assertUnifiedWeather.js';

const TEST_CITY = 'London';

describe('fetchOpenWeather (integration)', () => {
  let apiKey: string;

  beforeAll(() => {
    apiKey = process.env.OPENWEATHER_API_KEY ?? '';
    if (!apiKey) {
      throw new Error(
        'OPENWEATHER_API_KEY is not set.\n' +
          'Create packages/functions/.env.test with OPENWEATHER_API_KEY=<your key>.',
      );
    }
  });

  it('returns a valid UnifiedWeatherData for a known city', async () => {
    const data = await fetchOpenWeather(TEST_CITY, apiKey);

    assertUnifiedWeather(data, 'openweather');

    // City name should roughly match (OWM may return "London" or "City of London")
    expect(data.city.toLowerCase()).toContain('london');
    // UK country code
    expect(data.country).toBe('GB');
  });

  it('throws on an unknown city', async () => {
    await expect(
      fetchOpenWeather('ThisCityDefinitelyDoesNotExist_XYZ123', apiKey),
    ).rejects.toThrow(/OpenWeatherMap API error/);
  });

  it('throws on an invalid API key', async () => {
    await expect(fetchOpenWeather(TEST_CITY, 'invalid_key')).rejects.toThrow(
      /OpenWeatherMap API error 401/,
    );
  });
});

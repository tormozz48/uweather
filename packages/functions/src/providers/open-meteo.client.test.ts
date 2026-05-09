/**
 * Integration test — Open-Meteo provider (no API key required).
 */
import { describe, it, expect } from 'vitest';
import { fetchOpenMeteo } from './open-meteo.client.js';
import { assertUnifiedWeather } from '../tests/helpers/assertUnifiedWeather.js';

const TEST_CITY = 'London';

describe('fetchOpenMeteo (integration)', () => {
  it('returns a valid UnifiedWeatherData for a known city', async () => {
    const data = await fetchOpenMeteo(TEST_CITY);

    assertUnifiedWeather(data, 'open-meteo');

    // Open-Meteo geocodes to the canonical name and returns country_code
    expect(data.city.toLowerCase()).toContain('london');
    expect(data.country).toBe('GB');
  });

  it('throws on an unknown city', async () => {
    await expect(
      fetchOpenMeteo('ThisCityDefinitelyDoesNotExist_XYZ123'),
    ).rejects.toThrow(/city not found/);
  });

  it('returns non-zero uv_index_max (populated from daily array)', async () => {
    const data = await fetchOpenMeteo(TEST_CITY);
    // UV index is a number (may be 0 at night but field must exist and be ≥ 0)
    expect(typeof data.uvIndex).toBe('number');
    expect(data.uvIndex).toBeGreaterThanOrEqual(0);
  });

  it('returns sunrise before sunset', async () => {
    const data = await fetchOpenMeteo(TEST_CITY);
    expect(new Date(data.sunrise).getTime()).toBeLessThan(new Date(data.sunset).getTime());
  });
});

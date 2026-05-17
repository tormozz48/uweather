import { useCallback, useState } from 'react';

export type ReverseGeocodeStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ReversedCity {
  name: string;
  lat: number;
  lon: number;
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
}

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
/** Nominatim requires a meaningful User-Agent per usage policy */
const NOMINATIM_USER_AGENT = 'uweather/1.0 (https://github.com/numica/uweather)';
/** Zoom level 10 resolves to city/town granularity */
const NOMINATIM_CITY_ZOOM = '10';

function extractCityName(address: NominatimAddress): string | null {
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    null
  );
}

export function useReverseGeocode() {
  const [status, setStatus] = useState<ReverseGeocodeStatus>('idle');
  const [result, setResult] = useState<ReversedCity | null>(null);

  const lookup = useCallback(async (lat: number, lon: number): Promise<ReversedCity | null> => {
    setStatus('loading');
    setResult(null);

    try {
      const params = new URLSearchParams({
        format: 'json',
        lat: String(lat),
        lon: String(lon),
        zoom: NOMINATIM_CITY_ZOOM,
        addressdetails: '1',
      });

      const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
        headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      });

      if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

      const data = (await response.json()) as NominatimResponse;
      const name = data.address ? extractCityName(data.address) : null;

      if (!name) throw new Error('No city name in reverse geocode response');

      const city: ReversedCity = { name, lat, lon };
      setResult(city);
      setStatus('success');
      return city;
    } catch {
      setStatus('error');
      return null;
    }
  }, []);

  return { status, result, lookup };
}

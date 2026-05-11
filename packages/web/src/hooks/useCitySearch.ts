import { useCallback, useEffect, useRef, useState } from 'react';

export interface CitySuggestion {
  id: number;
  name: string;
  country: string;
  admin1: string | undefined; // region / state
  /** Display label shown in the dropdown */
  label: string;
  /** Coordinates returned by the geocoding API — used to avoid re-geocoding on the backend */
  lat: number;
  lon: number;
}

interface GeoResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

interface GeoResponse {
  results?: GeoResult[];
}

const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export function useCitySearch(query: string) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => setSuggestions([]), []);

  useEffect(() => {
    // Cancel previous timer & in-flight request
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({
          name: trimmed,
          count: '6',
          language: 'en',
          format: 'json',
        });

        const res = await fetch(`${GEO_API}?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error('geo api error');

        const data = (await res.json()) as GeoResponse;
        const results = data.results ?? [];

        setSuggestions(
          results.map((r) => ({
            id: r.id,
            name: r.name,
            country: r.country ?? '',
            admin1: r.admin1,
            label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
            lat: r.latitude,
            lon: r.longitude,
          })),
        );
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [query]);

  return { suggestions, isSearching, clear };
}

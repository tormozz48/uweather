import { useCallback, useState } from 'react';

export type GeolocationStatus = 'idle' | 'locating' | 'success' | 'denied' | 'unavailable';

export interface GeolocationCoords {
  lat: number;
  lon: number;
}

interface GeolocationState {
  status: GeolocationStatus;
  coords: GeolocationCoords | null;
}

const GEOLOCATION_TIMEOUT_MS = 10_000;
/** Accept a cached position up to 5 minutes old */
const GEOLOCATION_MAX_AGE_MS = 300_000;

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: 'idle', coords: null });

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: 'unavailable', coords: null });
      return;
    }

    setState({ status: 'locating', coords: null });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: 'success',
          coords: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
        });
      },
      (error) => {
        const isDenied = error.code === GeolocationPositionError.PERMISSION_DENIED;
        setState({ status: isDenied ? 'denied' : 'unavailable', coords: null });
      },
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: GEOLOCATION_MAX_AGE_MS },
    );
  }, []);

  return { status: state.status, coords: state.coords, request };
}

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { getHistory, pollForecastResult, startForecast } from '../api.js';
import { LANGUAGES } from '../constants/weather.js';
import type { ForecastResponse } from '../api.js';
import { ErrorCard } from '../components/ErrorCard.js';
import { ForecastSection } from '../components/ForecastSection.js';
import { HistoryList } from '../components/HistoryList.js';
import { PipelineProgress } from '../components/PipelineProgress.js';
import { SearchForm } from '../components/SearchForm.js';
import type { CityCoords } from '../components/SearchForm.js';
import { useForecastCompletion } from '../hooks/useForecastCompletion.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { usePipelineProgress } from '../hooks/usePipelineProgress.js';
import { useReverseGeocode } from '../hooks/useReverseGeocode.js';
import { getSessionId } from '../lib/session.js';

const FALLBACK_LANGUAGE = 'en';

function detectBrowserLanguage(): string {
  const supportedCodes = new Set(LANGUAGES.map((language) => language.code));
  for (const browserLang of navigator.languages ?? [navigator.language]) {
    const exact = browserLang.toLowerCase();
    if (supportedCodes.has(exact)) return exact;
    const primary = exact.split('-')[0];
    if (supportedCodes.has(primary)) return primary;
  }
  return FALLBACK_LANGUAGE;
}

type AppState =
  | { status: 'idle' }
  | { status: 'loading'; executionArn: string }
  | { status: 'success'; forecast: ForecastResponse }
  | { status: 'error'; message: string };

const MAX_HISTORY_DISPLAY = 10;

export function HomePage() {
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState<CityCoords | undefined>(undefined);
  const [lang, setLang] = useState(detectBrowserLanguage);
  const [state, setState] = useState<AppState>({ status: 'idle' });
  const [history, setHistory] = useState<ForecastResponse[]>([]);
  const sessionId = getSessionId();

  const geolocation = useGeolocation();
  const reverseGeocode = useReverseGeocode();

  const { lookup: lookupCity } = reverseGeocode;

  // When geolocation succeeds, reverse-geocode to a city name and populate the form
  useEffect(() => {
    if (geolocation.status !== 'success' || !geolocation.coords) return;
    const { lat, lon } = geolocation.coords;
    lookupCity(lat, lon).then((resolved) => {
      if (resolved) {
        setCity(resolved.name);
        setCoords({ lat: resolved.lat, lon: resolved.lon });
      }
    });
  }, [geolocation.status, geolocation.coords, lookupCity]);

  // WebSocket pipeline progress — active only during loading
  const executionArn = state.status === 'loading' ? state.executionArn : null;
  const progress = usePipelineProgress(executionArn);

  // Load history on mount
  useEffect(() => {
    getHistory(sessionId, 5)
      .then((res) => setHistory(res.forecasts))
      .catch(() => {
        // History is best-effort — silently ignore errors
      });
  }, [sessionId]);

  const addToHistory = useCallback((forecast: ForecastResponse) => {
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.forecastId !== forecast.forecastId);
      return [forecast, ...filtered].slice(0, MAX_HISTORY_DISPLAY);
    });
  }, []);

  // When pipeline completes via WebSocket, fetch the result
  useForecastCompletion({
    progress,
    state,
    onSuccess: (forecast) => {
      setState({ status: 'success', forecast });
      addToHistory(forecast);
    },
    onError: (message) => setState({ status: 'error', message }),
  });

  const handleCityChange = useCallback((value: string, newCoords?: CityCoords) => {
    setCity(value);
    setCoords(newCoords);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const trimmed = city.trim();
      if (!trimmed || state.status === 'loading') return;

      try {
        const arn = await startForecast(trimmed, lang, sessionId, coords);
        setState({ status: 'loading', executionArn: arn });

        if (!import.meta.env.VITE_WS_URL) {
          const forecast = await pollForecastResult(arn);
          setState({ status: 'success', forecast });
          addToHistory(forecast);
        }
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        });
      }
    },
    [city, coords, lang, sessionId, state.status, addToHistory],
  );

  const handleHistorySelect = (forecast: ForecastResponse) => {
    setCity(forecast.city);
    setState({ status: 'success', forecast });
  };

  const handleRetry = () => {
    setState({ status: 'idle' });
  };

  return (
    <Container
      maxWidth="sm"
      sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', px: 2 }}
    >
      <Box
        component="header"
        sx={{ textAlign: 'center', pt: { xs: 4, sm: 6 }, pb: { xs: 3, sm: 4 } }}
      >
        <Typography sx={{ fontSize: '3rem', display: 'block', lineHeight: 1, mb: 1 }}>🌤️</Typography>
        <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.5px' }}>
          uweather
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          AI-powered forecasts with a sense of humour
        </Typography>
      </Box>

      <Box
        component="main"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, pb: 5 }}
      >
        <SearchForm
          city={city}
          lang={lang}
          isLoading={state.status === 'loading'}
          geolocationStatus={geolocation.status}
          onCityChange={handleCityChange}
          onLangChange={setLang}
          onRequestLocation={geolocation.request}
          onSubmit={handleSubmit}
        />

        {state.status === 'loading' && (
          <PipelineProgress stages={progress.stages} connected={progress.connected} />
        )}

        {state.status === 'error' && <ErrorCard message={state.message} onRetry={handleRetry} />}

        {state.status === 'success' && <ForecastSection forecast={state.forecast} />}

        {state.status !== 'loading' && (
          <HistoryList forecasts={history} onSelect={handleHistorySelect} />
        )}
      </Box>

      <Divider />
      <Box component="footer" sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Powered by AWS Bedrock · Weather from OpenWeatherMap, WeatherAPI, Open-Meteo
        </Typography>
      </Box>
    </Container>
  );
}

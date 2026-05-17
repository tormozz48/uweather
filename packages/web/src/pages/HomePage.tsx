import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { getHistory, pollForecastResult, startForecast } from '../api.js';
import { LANGUAGES } from '../constants/weather.js';
import type { ForecastResponse } from '../api.js';
import { AppFooter } from '../components/AppFooter.js';
import { ErrorCard } from '../components/ErrorCard.js';
import { ForecastSection } from '../components/ForecastSection.js';
import { HistoryList } from '../components/HistoryList.js';
import { PipelineProgress } from '../components/PipelineProgress.js';
import { SearchForm } from '../components/SearchForm.js';
import type { CityCoords } from '../components/SearchForm.js';
import { StickySearchBar } from '../components/StickySearchBar.js';
import { useForecastCompletion } from '../hooks/useForecastCompletion.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { usePipelineProgress } from '../hooks/usePipelineProgress.js';
import { useReverseGeocode } from '../hooks/useReverseGeocode.js';
import { getSessionId } from '../lib/session.js';

const FALLBACK_LANGUAGE = 'en';
const MAX_HISTORY_DISPLAY = 10;
const SEARCH_AREA_MAX_WIDTH = 640;

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

  // Shared props passed to both the inline SearchForm and the StickySearchBar
  const searchFormProps = {
    city,
    lang,
    isLoading: state.status === 'loading',
    geolocationStatus: geolocation.status,
    onCityChange: handleCityChange,
    onLangChange: setLang,
    onRequestLocation: geolocation.request,
    onSubmit: handleSubmit,
  };

  const showStandaloneHistory =
    (state.status === 'idle' || state.status === 'error') && history.length > 0;

  return (
    <>
      {/* Fixed sticky bar — slides in after scrolling past the hero */}
      <StickySearchBar {...searchFormProps} />

      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Container
          maxWidth="lg"
          sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: { xs: 2, sm: 3 } }}
        >
          {/* Hero header */}
          <Box
            component="header"
            sx={{ textAlign: 'center', pt: { xs: 4, sm: 6 }, pb: { xs: 3, sm: 4 } }}
          >
            <Typography sx={{ fontSize: '3rem', display: 'block', lineHeight: 1, mb: 1 }}>
              🌤️
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.5px' }}>
              uweather
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              AI-powered forecasts with a sense of humour
            </Typography>
          </Box>

          <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', pb: 5 }}>
            {/* Search area — always centred, capped in width so it doesn't stretch on desktop */}
            <Box
              sx={{
                maxWidth: SEARCH_AREA_MAX_WIDTH,
                mx: 'auto',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <SearchForm {...searchFormProps} />

              {state.status === 'loading' && (
                <PipelineProgress stages={progress.stages} connected={progress.connected} />
              )}

              {state.status === 'error' && (
                <ErrorCard message={state.message} onRetry={handleRetry} />
              )}
            </Box>

            {/* Forecast results — full container width, responsive two-column on desktop */}
            {state.status === 'success' && (
              <ForecastSection
                forecast={state.forecast}
                history={history}
                onHistorySelect={handleHistorySelect}
              />
            )}

            {/* Recent forecasts — only shown when no forecast result is visible */}
            {showStandaloneHistory && (
              <Box sx={{ maxWidth: SEARCH_AREA_MAX_WIDTH, mx: 'auto', width: '100%', mt: 1 }}>
                <HistoryList forecasts={history} onSelect={handleHistorySelect} />
              </Box>
            )}
          </Box>
        </Container>

        <AppFooter />
      </Box>
    </>
  );
}

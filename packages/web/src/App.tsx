import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { getHistory, pollForecastResult, startForecast } from './api.js';
import type { ForecastResponse } from './api.js';
import { ErrorCard } from './components/ErrorCard.js';
import { ForecastSection } from './components/ForecastSection.js';
import { HistoryList } from './components/HistoryList.js';
import { PipelineProgress } from './components/PipelineProgress.js';
import { SearchForm } from './components/SearchForm.js';
import type { CityCoords } from './components/SearchForm.js';
import { useForecastCompletion } from './hooks/useForecastCompletion.js';
import { usePipelineProgress } from './hooks/usePipelineProgress.js';
import { getSessionId } from './lib/session.js';

type AppState =
  | { status: 'idle' }
  | { status: 'loading'; executionArn: string }
  | { status: 'success'; forecast: ForecastResponse }
  | { status: 'error'; message: string };

export function App() {
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState<CityCoords | undefined>(undefined);
  const [lang, setLang] = useState('en');
  const [state, setState] = useState<AppState>({ status: 'idle' });
  const [history, setHistory] = useState<ForecastResponse[]>([]);
  const sessionId = getSessionId();

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

  const MAX_HISTORY_DISPLAY = 10;

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
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = city.trim();
      if (!trimmed || state.status === 'loading') return;

      try {
        // Start the pipeline — get executionArn for WebSocket tracking
        const arn = await startForecast(trimmed, lang, sessionId, coords);
        setState({ status: 'loading', executionArn: arn });

        // If WebSocket is not available, fall back to REST polling immediately
        if (!import.meta.env.VITE_WS_URL) {
          const forecast = await pollForecastResult(arn);
          setState({ status: 'success', forecast });
          addToHistory(forecast);
        }
        // With WebSocket, the completion useEffect handles the result fetch
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
    <div className="app">
      <header className="app-header">
        <span className="app-header__logo">🌤️</span>
        <h1 className="app-header__title">uweather</h1>
        <p className="app-header__tagline">AI-powered forecasts with a sense of humour</p>
      </header>

      <main className="app-main">
        <SearchForm
          city={city}
          lang={lang}
          isLoading={state.status === 'loading'}
          onCityChange={handleCityChange}
          onLangChange={setLang}
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
      </main>

      <footer className="app-footer">
        <p>Powered by AWS Bedrock · Weather from OpenWeatherMap, WeatherAPI, Open-Meteo</p>
      </footer>
    </div>
  );
}

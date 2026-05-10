import { useState, useEffect, useCallback } from 'react';
import { getForecast, getHistory } from './api.js';
import type { ForecastResponse } from './api.js';
import { getSessionId } from './lib/session.js';
import { SearchForm } from './components/SearchForm.js';
import { LoadingSection } from './components/LoadingSection.js';
import { ErrorCard } from './components/ErrorCard.js';
import { ForecastSection } from './components/ForecastSection.js';
import { HistoryList } from './components/HistoryList.js';

type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; forecast: ForecastResponse }
  | { status: 'error'; message: string };

export function App() {
  const [city, setCity] = useState('');
  const [lang, setLang] = useState('en');
  const [state, setState] = useState<AppState>({ status: 'idle' });
  const [history, setHistory] = useState<ForecastResponse[]>([]);
  const sessionId = getSessionId();

  // Load history on mount
  useEffect(() => {
    getHistory(sessionId, 5)
      .then((res) => setHistory(res.forecasts))
      .catch(() => {
        // History is best-effort — silently ignore errors
      });
  }, [sessionId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = city.trim();
      if (!trimmed || state.status === 'loading') return;

      setState({ status: 'loading' });

      try {
        const forecast = await getForecast(trimmed, lang, sessionId);
        setState({ status: 'success', forecast });

        // Prepend to local history (avoid duplicates by forecastId)
        setHistory((prev) => {
          const filtered = prev.filter((f) => f.forecastId !== forecast.forecastId);
          return [forecast, ...filtered].slice(0, 10);
        });
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        });
      }
    },
    [city, lang, sessionId, state.status],
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
          onCityChange={setCity}
          onLangChange={setLang}
          onSubmit={handleSubmit}
        />

        {state.status === 'loading' && <LoadingSection />}

        {state.status === 'error' && (
          <ErrorCard message={state.message} onRetry={handleRetry} />
        )}

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

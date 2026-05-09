import { useState, useEffect, useCallback } from 'react';
import { getForecast, getHistory } from './api.js';
import type { ForecastResponse } from './api.js';

// ── Session ID (anonymous, persisted to sessionStorage) ───────────────────────

function getSessionId(): string {
  const key = 'uweather_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

// ── Condition icons (emoji) ───────────────────────────────────────────────────

const CONDITION_EMOJI: Record<string, string> = {
  sunny: '☀️',
  partly_cloudy: '⛅',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
  fog: '🌫️',
  windy: '💨',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function WeatherCard({ forecast }: { forecast: ForecastResponse }) {
  const w = forecast.weather;
  const emoji = CONDITION_EMOJI[w.condition] ?? '🌡️';
  const conditionLabel = w.condition.replace('_', ' ');

  return (
    <div className="weather-card">
      <div className="weather-card__header">
        <span className="weather-card__emoji">{emoji}</span>
        <div>
          <h2 className="weather-card__city">{forecast.city}</h2>
          <p className="weather-card__date">{forecast.date} · {conditionLabel}</p>
        </div>
      </div>

      <div className="weather-card__temps">
        <span className="weather-card__temp">{Math.round(w.temperature)}°C</span>
        <span className="weather-card__feels-like">feels like {Math.round(w.feelsLike)}°C</span>
      </div>

      <div className="weather-card__stats">
        <Stat icon="💧" label="Humidity" value={`${w.humidity}%`} />
        <Stat icon="💨" label="Wind" value={`${Math.round(w.windSpeed)} km/h ${w.windDirection}`} />
        {w.precipitation > 0 && (
          <Stat icon="🌂" label="Rain" value={`${w.precipitation.toFixed(1)} mm`} />
        )}
        {w.uvIndex > 0 && (
          <Stat icon="🔆" label="UV Index" value={String(w.uvIndex)} />
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat__icon">{icon}</span>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--image" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line skeleton--short" />
      <div className="skeleton skeleton--line" />
    </div>
  );
}

function HistoryList({ forecasts, onSelect }: { forecasts: ForecastResponse[]; onSelect: (f: ForecastResponse) => void }) {
  if (forecasts.length === 0) return null;

  return (
    <section className="history">
      <h3 className="history__title">Recent forecasts</h3>
      <ul className="history__list">
        {forecasts.map((f) => {
          const emoji = CONDITION_EMOJI[f.weather.condition] ?? '🌡️';
          return (
            <li key={f.forecastId} className="history__item" onClick={() => onSelect(f)}>
              <span className="history__emoji">{emoji}</span>
              <span className="history__city">{f.city}</span>
              <span className="history__date">{f.date}</span>
              <span className="history__temp">{Math.round(f.weather.temperature)}°C</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; forecast: ForecastResponse }
  | { status: 'error'; message: string };

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pl', label: 'Polski' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

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
        {/* Search form */}
        <form className="search-form" onSubmit={handleSubmit}>
          <div className="search-form__row">
            <input
              className="search-form__input"
              type="text"
              placeholder="Enter a city (e.g. Kyiv, London, Tokyo)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={state.status === 'loading'}
              autoFocus
            />
            <select
              className="search-form__lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={state.status === 'loading'}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="search-form__button"
            type="submit"
            disabled={!city.trim() || state.status === 'loading'}
          >
            {state.status === 'loading' ? 'Generating forecast…' : 'Get forecast'}
          </button>
        </form>

        {/* Loading state */}
        {state.status === 'loading' && (
          <div className="loading-section">
            <SkeletonCard />
            <p className="loading-section__hint">
              Consulting 3 weather services and generating a custom image… this takes 15–30 seconds.
            </p>
          </div>
        )}

        {/* Error state */}
        {state.status === 'error' && (
          <div className="error-card">
            <span className="error-card__icon">😕</span>
            <p className="error-card__message">{state.message}</p>
            <button className="error-card__retry" onClick={handleRetry}>
              Try again
            </button>
          </div>
        )}

        {/* Success state */}
        {state.status === 'success' && (
          <div className="forecast-section">
            <img
              className="forecast-image"
              src={state.forecast.imageUrl}
              alt={`Weather illustration for ${state.forecast.city}`}
            />
            <WeatherCard forecast={state.forecast} />
            <div className="funny-text">
              {state.forecast.funnyText.split('\n').map((para, i) =>
                para.trim() ? <p key={i}>{para}</p> : null,
              )}
            </div>
          </div>
        )}

        {/* History */}
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

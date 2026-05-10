import type { ForecastResponse } from '../api.js';
import { CONDITION_EMOJI } from '../constants/weather.js';

interface HistoryListProps {
  forecasts: ForecastResponse[];
  onSelect: (forecast: ForecastResponse) => void;
}

export function HistoryList({ forecasts, onSelect }: HistoryListProps) {
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

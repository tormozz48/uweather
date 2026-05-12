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
        {forecasts.map((forecast) => {
          const emoji = CONDITION_EMOJI[forecast.weather.condition] ?? '🌡️';
          return (
            <li key={forecast.forecastId} className="history__item">
              <button type="button" className="history__item-btn" onClick={() => onSelect(forecast)}>
                <span className="history__emoji">{emoji}</span>
                <span className="history__city">{forecast.city}</span>
                <span className="history__date">{forecast.date}</span>
                <span className="history__temp">{Math.round(forecast.weather.temperature)}°C</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import type { ForecastResponse } from '../api.js';
import { CONDITION_EMOJI } from '../constants/weather.js';

interface HistoryListProps {
  forecasts: ForecastResponse[];
  onSelect: (forecast: ForecastResponse) => void;
}

export function HistoryList({ forecasts, onSelect }: HistoryListProps) {
  if (forecasts.length === 0) return null;

  return (
    <section class="history">
      <h3 class="history__title">Recent forecasts</h3>
      <ul class="history__list">
        {forecasts.map((f) => {
          const emoji = CONDITION_EMOJI[f.weather.condition] ?? '🌡️';
          return (
            <li key={f.forecastId} class="history__item">
              <button type="button" class="history__item-btn" onClick={() => onSelect(f)}>
                <span class="history__emoji">{emoji}</span>
                <span class="history__city">{f.city}</span>
                <span class="history__date">{f.date}</span>
                <span class="history__temp">{Math.round(f.weather.temperature)}°C</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import type { ForecastResponse } from '../api.js';
import { CONDITION_EMOJI } from '../constants/weather.js';
import { Stat } from './Stat.js';

interface WeatherCardProps {
  forecast: ForecastResponse;
}

export function WeatherCard({ forecast }: WeatherCardProps) {
  const w = forecast.weather;
  const emoji = CONDITION_EMOJI[w.condition] ?? '🌡️';
  const conditionLabel = w.condition.replace('_', ' ');

  return (
    <div class="weather-card">
      <div class="weather-card__header">
        <span class="weather-card__emoji">{emoji}</span>
        <div>
          <h2 class="weather-card__city">{forecast.city}</h2>
          <p class="weather-card__date">
            {forecast.date} · {conditionLabel}
          </p>
        </div>
      </div>

      <div class="weather-card__temps">
        <span class="weather-card__temp">{Math.round(w.temperature)}°C</span>
        <span class="weather-card__feels-like">feels like {Math.round(w.feelsLike)}°C</span>
      </div>

      <div class="weather-card__stats">
        <Stat icon="💧" label="Humidity" value={`${w.humidity}%`} />
        <Stat icon="💨" label="Wind" value={`${Math.round(w.windSpeed)} km/h ${w.windDirection}`} />
        {w.precipitation > 0 && (
          <Stat icon="🌂" label="Rain" value={`${w.precipitation.toFixed(1)} mm`} />
        )}
        {w.uvIndex > 0 && <Stat icon="🔆" label="UV Index" value={String(w.uvIndex)} />}
      </div>
    </div>
  );
}

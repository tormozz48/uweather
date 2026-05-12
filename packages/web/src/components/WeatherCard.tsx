import type { ForecastResponse } from '../api.js';
import { CONDITION_EMOJI } from '../constants/weather.js';
import { Stat } from './Stat.js';

interface WeatherCardProps {
  forecast: ForecastResponse;
}

export function WeatherCard({ forecast }: WeatherCardProps) {
  const weather = forecast.weather;
  const emoji = CONDITION_EMOJI[weather.condition] ?? '🌡️';
  const conditionLabel = weather.condition.replace('_', ' ');

  return (
    <div className="weather-card">
      <div className="weather-card__header">
        <span className="weather-card__emoji">{emoji}</span>
        <div>
          <h2 className="weather-card__city">{forecast.city}</h2>
          <p className="weather-card__date">
            {forecast.date} · {conditionLabel}
          </p>
        </div>
      </div>

      <div className="weather-card__temps">
        <span className="weather-card__temp">{Math.round(weather.temperature)}°C</span>
        <span className="weather-card__feels-like">feels like {Math.round(weather.feelsLike)}°C</span>
      </div>

      <div className="weather-card__stats">
        <Stat icon="💧" label="Humidity" value={`${weather.humidity}%`} />
        <Stat icon="💨" label="Wind" value={`${Math.round(weather.windSpeed)} km/h ${weather.windDirection}`} />
        {weather.precipitation > 0 && (
          <Stat icon="🌂" label="Rain" value={`${weather.precipitation.toFixed(1)} mm`} />
        )}
        {weather.uvIndex > 0 && <Stat icon="🔆" label="UV Index" value={String(weather.uvIndex)} />}
      </div>
    </div>
  );
}

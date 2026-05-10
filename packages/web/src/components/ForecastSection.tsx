import type { ForecastResponse } from '../api.js';
import { WeatherCard } from './WeatherCard.js';

interface ForecastSectionProps {
  forecast: ForecastResponse;
}

export function ForecastSection({ forecast }: ForecastSectionProps) {
  return (
    <div className="forecast-section">
      <img
        className="forecast-image"
        src={forecast.imageUrl}
        alt={`Weather illustration for ${forecast.city}`}
      />
      <WeatherCard forecast={forecast} />
      <div className="funny-text">
        {forecast.funnyText.split('\n').map((para, i) =>
          para.trim() ? <p key={i}>{para}</p> : null,
        )}
      </div>
    </div>
  );
}

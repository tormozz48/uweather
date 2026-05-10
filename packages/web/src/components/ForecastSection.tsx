import type { ForecastResponse } from '../api.js';
import { WeatherCard } from './WeatherCard.js';

interface ForecastSectionProps {
  forecast: ForecastResponse;
}

export function ForecastSection({ forecast }: ForecastSectionProps) {
  return (
    <div class="forecast-section">
      <img
        class="forecast-image"
        src={forecast.imageUrl}
        alt={`Weather illustration for ${forecast.city}`}
      />
      <WeatherCard forecast={forecast} />
      <div class="funny-text">
        {forecast.funnyText
          .split('\n')
          .filter((para) => para.trim())
          .map((para) => <p key={para}>{para}</p>)}
      </div>
    </div>
  );
}

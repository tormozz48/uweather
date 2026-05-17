import Box from '@mui/material/Box';
import type { ForecastResponse } from '../api.js';
import { ForecastImage } from './ForecastImage.js';
import { ForecastText } from './ForecastText.js';
import { WeatherCard } from './WeatherCard.js';

interface ForecastSectionProps {
  forecast: ForecastResponse;
}

export function ForecastSection({ forecast }: ForecastSectionProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, animation: 'fadeIn 0.3s ease' }}>
      <ForecastImage
        imageUrl={forecast.imageUrl}
        city={forecast.city}
        forecastId={forecast.forecastId}
      />
      <WeatherCard forecast={forecast} />
      <ForecastText funnyText={forecast.funnyText} />
    </Box>
  );
}

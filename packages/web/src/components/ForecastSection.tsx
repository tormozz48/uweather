import Box from '@mui/material/Box';
import type { ForecastResponse } from '../api.js';
import { ForecastImage } from './ForecastImage.js';
import { ForecastText } from './ForecastText.js';
import { HistoryList } from './HistoryList.js';
import { WeatherCard } from './WeatherCard.js';

interface ForecastSectionProps {
  forecast: ForecastResponse;
  history?: ForecastResponse[];
  onHistorySelect?: (forecast: ForecastResponse) => void;
}

export function ForecastSection({
  forecast,
  history = [],
  onHistorySelect = () => undefined,
}: ForecastSectionProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2, md: 3 },
        animation: 'fadeIn 0.3s ease',
        mt: 2,
        // On mobile: single column in reading order (image → weather → text → history)
        // On desktop: two columns — left panel (image/weather/history) + right panel (text spanning all rows)
        gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
        gridTemplateAreas: {
          xs: '"image" "weather" "text" "history"',
          md: '"image text" "weather text" "history text"',
        },
      }}
    >
      <Box sx={{ gridArea: 'image' }}>
        <ForecastImage
          imageUrl={forecast.imageUrl}
          city={forecast.city}
          forecastId={forecast.forecastId}
        />
      </Box>

      <Box sx={{ gridArea: 'weather' }}>
        <WeatherCard forecast={forecast} />
      </Box>

      <Box sx={{ gridArea: 'text' }}>
        <ForecastText funnyText={forecast.funnyText} />
      </Box>

      <Box sx={{ gridArea: 'history' }}>
        {history.length > 0 && <HistoryList forecasts={history} onSelect={onHistorySelect} />}
      </Box>
    </Box>
  );
}

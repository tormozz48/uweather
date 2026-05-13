import AirIcon from '@mui/icons-material/Air';
import UmbrellaIcon from '@mui/icons-material/Umbrella';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type { ForecastResponse } from '../api.js';
import { CONDITION_EMOJI } from '../constants/weather.js';

interface WeatherCardProps {
  forecast: ForecastResponse;
}

export function WeatherCard({ forecast }: WeatherCardProps) {
  const weather = forecast.weather;
  const emoji = CONDITION_EMOJI[weather.condition] ?? '🌡️';
  const conditionLabel = weather.condition.replace('_', ' ');

  return (
    <Card>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        {/* City + condition header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography sx={{ fontSize: '2.4rem', lineHeight: 1 }}>{emoji}</Typography>
          <Box>
            <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
              {forecast.city}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'capitalize' }}
            >
              {forecast.date} · {conditionLabel}
            </Typography>
          </Box>
        </Box>

        {/* Temperature */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2.5 }}>
          <Typography variant="h3" fontWeight={700} sx={{ letterSpacing: '-1px' }}>
            {Math.round(weather.temperature)}°C
          </Typography>
          <Typography variant="body2" color="text.secondary">
            feels like {Math.round(weather.feelsLike)}°C
          </Typography>
        </Box>

        {/* Stats chips with MUI icons */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            size="small"
            icon={<WaterDropIcon fontSize="small" />}
            label={`Humidity ${weather.humidity}%`}
            variant="outlined"
          />
          <Chip
            size="small"
            icon={<AirIcon fontSize="small" />}
            label={`Wind ${Math.round(weather.windSpeed)} km/h ${weather.windDirection}`}
            variant="outlined"
          />
          {weather.precipitation > 0 && (
            <Chip
              size="small"
              icon={<UmbrellaIcon fontSize="small" />}
              label={`Rain ${weather.precipitation.toFixed(1)} mm`}
              variant="outlined"
            />
          )}
          {weather.uvIndex > 0 && (
            <Chip
              size="small"
              icon={<WbSunnyIcon fontSize="small" />}
              label={`UV ${weather.uvIndex}`}
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

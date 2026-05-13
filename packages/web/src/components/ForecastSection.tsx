import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ForecastResponse } from '../api.js';
import { WeatherCard } from './WeatherCard.js';

interface ForecastSectionProps {
  forecast: ForecastResponse;
}

export function ForecastSection({ forecast }: ForecastSectionProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, animation: 'fadeIn 0.3s ease' }}>
      <Box
        component="img"
        src={forecast.imageUrl}
        alt={`Weather illustration for ${forecast.city}`}
        sx={{
          width: '100%',
          borderRadius: 2,
          objectFit: 'cover',
          aspectRatio: '16/9',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          display: 'block',
        }}
      />

      <WeatherCard forecast={forecast} />

      <Paper sx={{ p: 3 }}>
        {forecast.funnyText
          .split('\n')
          .filter((para) => para.trim())
          .map((para) => (
            <Typography key={para} variant="body1" sx={{ lineHeight: 1.7, '& + &': { mt: 1.5 } }}>
              {para}
            </Typography>
          ))}
      </Paper>
    </Box>
  );
}

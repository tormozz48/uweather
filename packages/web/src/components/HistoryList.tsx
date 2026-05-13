import HistoryIcon from '@mui/icons-material/History';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import type { ForecastResponse } from '../api.js';
import { CONDITION_EMOJI } from '../constants/weather.js';

interface HistoryListProps {
  forecasts: ForecastResponse[];
  onSelect: (forecast: ForecastResponse) => void;
}

export function HistoryList({ forecasts, onSelect }: HistoryListProps) {
  if (forecasts.length === 0) return null;

  return (
    <Box component="section">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        <HistoryIcon sx={{ fontSize: '0.95rem', color: 'text.secondary' }} />
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ lineHeight: 1, letterSpacing: '0.08em' }}
        >
          Recent forecasts
        </Typography>
      </Box>

      <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {forecasts.map((forecast) => {
          const emoji = CONDITION_EMOJI[forecast.weather.condition] ?? '🌡️';
          return (
            <ListItemButton
              key={forecast.forecastId}
              onClick={() => onSelect(forecast)}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                borderRadius: 1,
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                px: 1.75,
                py: 1.25,
              }}
            >
              <Typography sx={{ mr: 1.5, fontSize: '1.1rem', lineHeight: 1 }}>{emoji}</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                {forecast.city}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                {forecast.date}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 40, textAlign: 'right' }}>
                {Math.round(forecast.weather.temperature)}°C
              </Typography>
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

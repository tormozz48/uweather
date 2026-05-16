import ShareIcon from '@mui/icons-material/Share';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';
import type { ForecastResponse } from '../api.js';
import { WeatherCard } from './WeatherCard.js';

const SNACKBAR_DURATION_MS = 2500;

interface ForecastSectionProps {
  forecast: ForecastResponse;
}

export function ForecastSection({ forecast }: ForecastSectionProps) {
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/forecast/${forecast.forecastId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setSnackbarOpen(true);
    } catch {
      // Fallback: select a temporary input (older browsers / insecure contexts)
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setSnackbarOpen(true);
    }
  }, [forecast.forecastId]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, animation: 'fadeIn 0.3s ease' }}>
      <Box sx={{ position: 'relative' }}>
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
        <Tooltip title="Copy share link">
          <IconButton
            onClick={handleShare}
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              backdropFilter: 'blur(4px)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <ShareIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

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

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={SNACKBAR_DURATION_MS}
        onClose={() => setSnackbarOpen(false)}
        message="Link copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

import ShareIcon from '@mui/icons-material/Share';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import { useCallback, useState } from 'react';

const SNACKBAR_DURATION_MS = 2500;

interface ForecastImageProps {
  imageUrl: string;
  city: string;
  forecastId: string;
}

export function ForecastImage({ imageUrl, city, forecastId }: ForecastImageProps) {
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/forecast/${forecastId}`;

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
  }, [forecastId]);

  return (
    <>
      <Box sx={{ position: 'relative' }}>
        <Box
          component="img"
          src={imageUrl}
          alt={`Weather illustration for ${city}`}
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

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={SNACKBAR_DURATION_MS}
        onClose={() => setSnackbarOpen(false)}
        message="Link copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

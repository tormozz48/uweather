import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { type ForecastResponse, getForecastById } from '../api.js';
import { ErrorCard } from '../components/ErrorCard.js';
import { ForecastSection } from '../components/ForecastSection.js';

type PageState =
  | { status: 'loading' }
  | { status: 'success'; forecast: ForecastResponse }
  | { status: 'error'; message: string };

/**
 * Public read-only page for a shared forecast.
 * Mounted at /forecast/:forecastId — no authentication required.
 */
export function SharedForecastPage() {
  const { forecastId } = useParams<{ forecastId: string }>();
  const [state, setState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    if (!forecastId) {
      setState({ status: 'error', message: 'No forecast ID provided.' });
      return;
    }

    let cancelled = false;

    getForecastById(forecastId)
      .then((forecast) => {
        if (!cancelled) setState({ status: 'success', forecast });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load forecast.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [forecastId]);

  return (
    <Container
      maxWidth="sm"
      sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', px: 2 }}
    >
      <Box
        component="header"
        sx={{ textAlign: 'center', pt: { xs: 4, sm: 6 }, pb: { xs: 3, sm: 4 } }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Typography sx={{ fontSize: '3rem', display: 'block', lineHeight: 1, mb: 1 }}>
            🌤️
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.5px' }}>
            uweather
          </Typography>
        </Link>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          AI-powered forecasts with a sense of humour
        </Typography>
      </Box>

      <Box
        component="main"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, pb: 5 }}
      >
        {state.status === 'loading' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {state.status === 'error' && (
          <ErrorCard
            message={state.message}
            onRetry={() => window.location.reload()}
          />
        )}

        {state.status === 'success' && (
          <>
            <ForecastSection forecast={state.forecast} />

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                component={Link}
                to="/"
                variant="outlined"
                size="large"
                sx={{ borderRadius: 3 }}
              >
                Get your own funny forecast
              </Button>
            </Box>
          </>
        )}
      </Box>

      <Divider />
      <Box component="footer" sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Powered by AWS Bedrock · Weather from OpenWeatherMap, WeatherAPI, Open-Meteo
        </Typography>
      </Box>
    </Container>
  );
}

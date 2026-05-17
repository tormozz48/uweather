import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

const CURRENT_YEAR = new Date().getFullYear();

export function AppFooter() {
  return (
    <Box component="footer" sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 'auto' }}>
      <Container maxWidth="lg" sx={{ pt: 4, pb: 2, px: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr' },
            gap: { xs: 3, md: 4 },
            mb: 3,
          }}
        >
          {/* Brand */}
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}
            >
              🌤️ uweather
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              AI-powered forecasts with a sense of humour. Built for humans who like their weather
              served with a side of wit.
            </Typography>
          </Box>

          {/* Weather data sources */}
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: '0.08em', display: 'block', mb: 1 }}
            >
              Weather data
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 2 }}>
              OpenWeatherMap
              <br />
              WeatherAPI
              <br />
              Open-Meteo
            </Typography>
          </Box>

          {/* Powered by */}
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: '0.08em', display: 'block', mb: 1 }}
            >
              Powered by
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 2 }}>
              AWS Bedrock · Claude Haiku
              <br />
              AWS Step Functions
              <br />
              Amazon DynamoDB
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
          © {CURRENT_YEAR} uweather · All forecasts are for entertainment purposes only
        </Typography>
      </Container>
    </Box>
  );
}

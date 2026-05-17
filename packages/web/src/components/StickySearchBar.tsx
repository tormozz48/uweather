import SearchIcon from '@mui/icons-material/Search';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Slide from '@mui/material/Slide';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import type { FormEvent } from 'react';
import type { GeolocationStatus } from '../hooks/useGeolocation.js';
import { CityAutocomplete, type CityCoords } from './CityAutocomplete.js';
import { LanguageSelect } from './LanguageSelect.js';

const SCROLL_TRIGGER_THRESHOLD = 120;

interface StickySearchBarProps {
  city: string;
  lang: string;
  isLoading: boolean;
  geolocationStatus: GeolocationStatus;
  onCityChange: (city: string, coords?: CityCoords) => void;
  onLangChange: (lang: string) => void;
  onRequestLocation: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function StickySearchBar({
  city,
  lang,
  isLoading,
  geolocationStatus,
  onCityChange,
  onLangChange,
  onRequestLocation,
  onSubmit,
}: StickySearchBarProps) {
  const isTriggered = useScrollTrigger({
    disableHysteresis: false,
    threshold: SCROLL_TRIGGER_THRESHOLD,
  });

  return (
    <Slide in={isTriggered} direction="down">
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'rgba(15, 17, 23, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 56 } }}>
          <Typography
            fontWeight={700}
            fontSize="0.95rem"
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              gap: 0.75,
              whiteSpace: 'nowrap',
              mr: 0.5,
            }}
          >
            🌤️ uweather
          </Typography>

          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <CityAutocomplete
                city={city}
                isLoading={isLoading}
                geolocationStatus={geolocationStatus}
                onCityChange={onCityChange}
                onRequestLocation={onRequestLocation}
                size="small"
              />
            </Box>

            <LanguageSelect lang={lang} isLoading={isLoading} onLangChange={onLangChange} />

            <IconButton
              type="submit"
              disabled={!city.trim() || isLoading}
              color="primary"
              aria-label="Search"
              sx={{
                bgcolor: city.trim() && !isLoading ? 'primary.main' : undefined,
                color: city.trim() && !isLoading ? 'white' : undefined,
                borderRadius: 1.5,
                flexShrink: 0,
                '&:hover': { bgcolor: 'primary.dark', color: 'white' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
              }}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
    </Slide>
  );
}

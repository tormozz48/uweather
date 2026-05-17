import MyLocationIcon from '@mui/icons-material/MyLocation';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCitySearch } from '../hooks/useCitySearch.js';
import type { GeolocationStatus } from '../hooks/useGeolocation.js';

export interface CityCoords {
  lat: number;
  lon: number;
}

const GEOLOCATION_TOOLTIP: Record<GeolocationStatus, string> = {
  idle: 'Use my location',
  locating: 'Detecting location…',
  success: 'Use my location',
  denied: 'Location access denied — check browser settings',
  unavailable: 'Location unavailable',
};

interface CityAutocompleteProps {
  city: string;
  isLoading: boolean;
  geolocationStatus: GeolocationStatus;
  onCityChange: (city: string, coords?: CityCoords) => void;
  onRequestLocation: () => void;
}

export function CityAutocomplete({
  city,
  isLoading,
  geolocationStatus,
  onCityChange,
  onRequestLocation,
}: CityAutocompleteProps) {
  const { suggestions, isSearching, clear } = useCitySearch(city);

  const isLocating = geolocationStatus === 'locating';
  const locationDisabled = isLoading || isLocating;

  return (
    <Autocomplete
      freeSolo
      options={suggestions}
      // Show just the city name in the input field after selection
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
      // Filtering is done server-side by the geocoding API
      filterOptions={(options) => options}
      loading={isSearching}
      inputValue={city}
      onInputChange={(_, value, reason) => {
        // 'reset' fires after an option is selected — onChange already set the coords
        if (reason === 'input') {
          onCityChange(value, undefined);
        }
      }}
      onChange={(_, value) => {
        if (value && typeof value !== 'string') {
          onCityChange(value.name, { lat: value.lat, lon: value.lon });
          clear();
        }
      }}
      disabled={isLoading}
      sx={{ flex: 1 }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Enter a city (e.g. Kyiv, London, Tokyo)"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <Tooltip title={GEOLOCATION_TOOLTIP[geolocationStatus]} placement="top">
                <span>
                  <IconButton
                    size="small"
                    onClick={onRequestLocation}
                    disabled={locationDisabled}
                    aria-label="Use my location"
                    sx={{ mr: 0.5, color: geolocationStatus === 'success' ? 'primary.main' : 'action.active' }}
                  >
                    {isLocating ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <MyLocationIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            ),
            endAdornment: (
              <>
                {isSearching && <CircularProgress color="inherit" size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Box sx={{ py: 0.25 }}>
            <Typography variant="body2" fontWeight={600}>
              {option.name}
            </Typography>
            {(option.admin1 ?? option.country) && (
              <Typography variant="caption" color="text.secondary" display="block">
                {[option.admin1, option.country].filter(Boolean).join(', ')}
              </Typography>
            )}
          </Box>
        </li>
      )}
    />
  );
}

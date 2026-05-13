import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCitySearch } from '../hooks/useCitySearch.js';

export interface CityCoords {
  lat: number;
  lon: number;
}

interface CityAutocompleteProps {
  city: string;
  isLoading: boolean;
  onCityChange: (city: string, coords?: CityCoords) => void;
}

export function CityAutocomplete({ city, isLoading, onCityChange }: CityAutocompleteProps) {
  const { suggestions, isSearching, clear } = useCitySearch(city);

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

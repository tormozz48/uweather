import { type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import SearchIcon from '@mui/icons-material/Search';
import { CityAutocomplete, type CityCoords } from './CityAutocomplete.js';
import { LanguageSelect } from './LanguageSelect.js';

export type { CityCoords } from './CityAutocomplete.js';

interface SearchFormProps {
  city: string;
  lang: string;
  isLoading: boolean;
  onCityChange: (city: string, coords?: CityCoords) => void;
  onLangChange: (lang: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function SearchForm({
  city,
  lang,
  isLoading,
  onCityChange,
  onLangChange,
  onSubmit,
}: SearchFormProps) {
  return (
    <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <CityAutocomplete city={city} isLoading={isLoading} onCityChange={onCityChange} />
        <LanguageSelect lang={lang} isLoading={isLoading} onLangChange={onLangChange} />
      </Stack>

      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        disabled={!city.trim() || isLoading}
        startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
      >
        {isLoading ? 'Generating forecast…' : 'Get forecast'}
      </Button>
    </Box>
  );
}

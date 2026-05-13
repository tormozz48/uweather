import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { LANGUAGES } from '../constants/weather.js';

interface LanguageSelectProps {
  lang: string;
  isLoading: boolean;
  onLangChange: (lang: string) => void;
}

export function LanguageSelect({ lang, isLoading, onLangChange }: LanguageSelectProps) {
  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <Select
        value={lang}
        onChange={(event) => onLangChange(event.target.value)}
        disabled={isLoading}
      >
        {LANGUAGES.map((language) => (
          <MenuItem key={language.code} value={language.code}>
            {language.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

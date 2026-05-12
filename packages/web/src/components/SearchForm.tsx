import { type FormEvent } from 'react';
import { CityAutocomplete, type CityCoords } from './CityAutocomplete.js';
import { LanguageSelect } from './LanguageSelect.js';

export type { CityCoords } from './CityAutocomplete.js';

interface SearchFormProps {
  city: string;
  lang: string;
  isLoading: boolean;
  onCityChange: (city: string, coords?: CityCoords) => void;
  onLangChange: (lang: string) => void;
  onSubmit: (e: FormEvent) => void;
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
    <form className="search-form" onSubmit={onSubmit}>
      <div className="search-form__row">
        <CityAutocomplete city={city} isLoading={isLoading} onCityChange={onCityChange} />
        <LanguageSelect lang={lang} isLoading={isLoading} onLangChange={onLangChange} />
      </div>

      <button className="search-form__button" type="submit" disabled={!city.trim() || isLoading}>
        {isLoading ? 'Generating forecast…' : 'Get forecast'}
      </button>
    </form>
  );
}

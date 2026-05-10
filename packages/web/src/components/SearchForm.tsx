import { LANGUAGES } from '../constants/weather.js';

interface SearchFormProps {
  city: string;
  lang: string;
  isLoading: boolean;
  onCityChange: (city: string) => void;
  onLangChange: (lang: string) => void;
  onSubmit: (e: React.FormEvent) => void;
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
    <form class="search-form" onSubmit={onSubmit}>
      <div class="search-form__row">
        <input
          class="search-form__input"
          type="text"
          placeholder="Enter a city (e.g. Kyiv, London, Tokyo)"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          disabled={isLoading}
        />
        <select
          class="search-form__lang"
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          disabled={isLoading}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <button class="search-form__button" type="submit" disabled={!city.trim() || isLoading}>
        {isLoading ? 'Generating forecast…' : 'Get forecast'}
      </button>
    </form>
  );
}

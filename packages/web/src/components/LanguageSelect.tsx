import { LANGUAGES } from '../constants/weather.js';

interface LanguageSelectProps {
  lang: string;
  isLoading: boolean;
  onLangChange: (lang: string) => void;
}

export function LanguageSelect({ lang, isLoading, onLangChange }: LanguageSelectProps) {
  return (
    <select
      className="search-form__lang"
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
  );
}

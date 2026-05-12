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
      {LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  );
}

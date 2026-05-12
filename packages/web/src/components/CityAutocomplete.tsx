import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const { suggestions, isSearching, clear } = useCitySearch(city);

  // Open dropdown whenever we have suggestions
  useEffect(() => {
    if (suggestions.length > 0) {
      setIsOpen(true);
      setActiveIndex(-1);
    } else {
      setIsOpen(false);
    }
  }, [suggestions]);

  // Close on click outside
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function selectSuggestion(name: string, coords: CityCoords) {
    onCityChange(name, coords);
    clear();
    setIsOpen(false);
    setActiveIndex(-1);
    // Return focus to input so user can immediately submit
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          e.preventDefault();
          const s = suggestions[activeIndex];
          selectSuggestion(s.name, { lat: s.lat, lon: s.lon });
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  const activeId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="city-autocomplete" ref={containerRef}>
      <input
        ref={inputRef}
        className="search-form__input"
        type="text"
        placeholder="Enter a city (e.g. Kyiv, London, Tokyo)"
        value={city}
        onChange={(e) => onCityChange(e.target.value, undefined)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        disabled={isLoading}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
      />

      {isSearching && (
        <span className="city-autocomplete__spinner" aria-hidden="true" />
      )}

      {isOpen && suggestions.length > 0 && (
        <div
          className="city-autocomplete__dropdown"
          id={listboxId}
          role="listbox"
          aria-label="City suggestions"
          tabIndex={-1}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              id={`${listboxId}-option-${i}`}
              className={`city-autocomplete__item${i === activeIndex ? ' city-autocomplete__item--active' : ''}`}
              role="option"
              aria-selected={i === activeIndex}
              tabIndex={-1}
              onPointerDown={(e) => {
                // Prevent blur on input before click fires
                e.preventDefault();
                selectSuggestion(s.name, { lat: s.lat, lon: s.lon });
              }}
            >
              <span className="city-autocomplete__item-name">{s.name}</span>
              {(s.admin1 ?? s.country) && (
                <span className="city-autocomplete__item-sub">
                  {[s.admin1, s.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

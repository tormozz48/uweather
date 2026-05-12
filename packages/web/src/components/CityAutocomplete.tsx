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
        setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          e.preventDefault();
          const suggestion = suggestions[activeIndex];
          selectSuggestion(suggestion.name, { lat: suggestion.lat, lon: suggestion.lon });
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
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              id={`${listboxId}-option-${index}`}
              className={`city-autocomplete__item${index === activeIndex ? ' city-autocomplete__item--active' : ''}`}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              onPointerDown={(e) => {
                // Prevent blur on input before click fires
                e.preventDefault();
                selectSuggestion(suggestion.name, { lat: suggestion.lat, lon: suggestion.lon });
              }}
            >
              <span className="city-autocomplete__item-name">{suggestion.name}</span>
              {(suggestion.admin1 ?? suggestion.country) && (
                <span className="city-autocomplete__item-sub">
                  {[suggestion.admin1, suggestion.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

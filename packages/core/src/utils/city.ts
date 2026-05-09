/**
 * Normalize a city name for use in cache keys and DynamoDB PKs.
 * Rules: lowercase, trimmed, diacritics removed.
 * e.g. "München" → "munchen", "  Kyiv  " → "kyiv"
 */
export function normalizeCity(city: string): string {
  return (
    city
      .trim()
      // Decompose accented chars into base letter + combining diacritical mark,
      // then strip all "Mark, Nonspacing" characters (i.e. the diacritics).
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .toLowerCase()
  );
}

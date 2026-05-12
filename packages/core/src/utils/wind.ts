/**
 * Wind direction utility — converts meteorological degrees to a cardinal
 * compass direction abbreviation.
 */

const CARDINAL_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const DEGREES_PER_DIRECTION = 45;

/**
 * Convert a wind bearing in degrees (0–360) to a cardinal direction abbreviation.
 * e.g. 0 → "N", 90 → "E", 225 → "SW"
 */
export function degreesToCardinal(degrees: number): string {
  const index = Math.round(degrees / DEGREES_PER_DIRECTION) % CARDINAL_DIRECTIONS.length;
  return CARDINAL_DIRECTIONS[index] ?? 'N';
}

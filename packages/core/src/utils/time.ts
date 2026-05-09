export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Derive a time slot from an hour (0-23) in the city's local time.
 *
 * morning:   05:00–11:59
 * afternoon: 12:00–16:59
 * evening:   17:00–20:59
 * night:     21:00–04:59
 */
export function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Return the current time slot based on UTC hour.
 * For more accurate results, callers should convert to the city's local timezone first.
 */
export function getCurrentTimeSlot(): TimeSlot {
  return getTimeSlot(new Date().getUTCHours());
}

/**
 * Format a Date as YYYY-MM-DD (UTC).
 */
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

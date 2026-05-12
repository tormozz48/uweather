export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

const MORNING_START_HOUR = 5;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 17;
const NIGHT_START_HOUR = 21;

/**
 * Derive a time slot from an hour (0-23) in the city's local time.
 *
 * morning:   05:00–11:59
 * afternoon: 12:00–16:59
 * evening:   17:00–20:59
 * night:     21:00–04:59
 */
export function getTimeSlot(hour: number): TimeSlot {
  if (hour >= MORNING_START_HOUR && hour < AFTERNOON_START_HOUR) return 'morning';
  if (hour >= AFTERNOON_START_HOUR && hour < EVENING_START_HOUR) return 'afternoon';
  if (hour >= EVENING_START_HOUR && hour < NIGHT_START_HOUR) return 'evening';
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

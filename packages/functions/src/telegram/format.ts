/**
 * Message formatting helpers for the Telegram bot.
 *
 * Converts a ForecastResult into a Telegram-ready Markdown caption,
 * and provides the shared condition → emoji mapping used by multiple commands.
 */
import type { ForecastResult } from '@uweather/core';

export const CONDITION_EMOJI: Record<string, string> = {
  sunny: '☀️',
  partly_cloudy: '⛅',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
  fog: '🌫️',
  windy: '💨',
};

/**
 * Build a Markdown caption for a forecast photo message.
 * Includes city, date, funny text, and key weather stats.
 */
export function formatForecastCaption(forecast: ForecastResult): string {
  const w = forecast.weatherSummary;
  const emoji = CONDITION_EMOJI[w.condition] ?? '🌡️';

  const lines = [
    `${emoji} *${forecast.city}* — ${forecast.date}`,
    '',
    forecast.funnyText,
    '',
    `🌡️ *${Math.round(w.temperature)}°C* (feels like ${Math.round(w.feelsLike)}°C)`,
    `💧 Humidity: ${w.humidity}%  |  💨 Wind: ${Math.round(w.windSpeed)} km/h ${w.windDirection}`,
  ];

  if (w.precipitation > 0) {
    lines.push(`🌂 Precipitation: ${w.precipitation.toFixed(1)} mm`);
  }
  if (w.uvIndex >= 3) {
    lines.push(`🔆 UV Index: ${w.uvIndex}`);
  }
  if (w.visibility < 5) {
    lines.push(`👁️ Low visibility: ${w.visibility} km`);
  }

  return lines.join('\n');
}

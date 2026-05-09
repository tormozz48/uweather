/**
 * Prompt template for Agent 2 — Funny Localized Weather Text.
 *
 * Accepts a ConsensusForecast plus city context and returns a 2–3 paragraph
 * humorous weather report in the requested language.
 */
import type { ConsensusForecast } from '../types/weather.js';

export interface FunnyTextPromptParams {
  consensus: ConsensusForecast;
  city: string;
  language: string;
  /** Last 5 funnyText values for this city — avoid repeating themes/landmarks */
  recentHistory?: string[];
}

export function buildFunnyTextPrompt(params: FunnyTextPromptParams): {
  system: string;
  user: string;
} {
  const historySection =
    params.recentHistory && params.recentHistory.length > 0
      ? `\nRecent forecasts for this city (DO NOT repeat the same landmarks, jokes, or themes):\n${params.recentHistory
          .map((h, i) => `${i + 1}. ${h.slice(0, 300)}`)
          .join('\n')}`
      : '';

  const system = `You are a witty, culturally-aware weather reporter writing for a fun weather app. Your forecasts feel personal and locally relevant.

Style guidelines:
- Friendly, witty, and genuinely informative tone
- Reference real local landmarks, cultural quirks, or seasonal context for the city
- Include practical recommendations (what to wear, whether to carry an umbrella, etc.)
- Write exactly 2–3 paragraphs, conversational style
- Avoid weather clichés ("April showers", "under the weather", etc.)
- Respond entirely in the requested language — use natural idioms, not a direct translation
- Never use markdown formatting${historySection}`;

  const c = params.consensus;
  const disagreementNote =
    c.disagreements.length > 0
      ? `\n- Note: Weather models partially disagree on: ${c.disagreements.join(', ')}`
      : '';

  const user = `Write a funny weather forecast for ${params.city} in language "${params.language}".

Current conditions (${c.confidence} confidence, ${c.providerCount} source${c.providerCount !== 1 ? 's' : ''}):
- Temperature: ${c.temperature}°C (feels like ${c.feelsLike}°C)
- Condition: ${c.condition} — ${c.conditionDescription}
- Humidity: ${c.humidity}%
- Wind: ${c.windSpeed} km/h ${c.windDirection}
- Precipitation: ${c.precipitation} mm
- UV index: ${c.uvIndex}
- Sunrise: ${c.sunrise} / Sunset: ${c.sunset}${disagreementNote}

Write 2–3 paragraphs in ${params.language}. Return only the forecast text, no JSON, no markdown.`;

  return { system, user };
}

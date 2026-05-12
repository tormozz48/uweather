/**
 * Prompt template for Agent 2 — Funny Localized Weather Text.
 *
 * Accepts a ConsensusForecast plus city context and returns a 2–3 paragraph
 * humorous weather report in the requested language.
 */
import type { ConsensusForecast } from '../types/weather.js';

/** Max characters taken from each history entry to avoid oversized prompts. */
const HISTORY_EXCERPT_LENGTH = 300;

export interface FunnyTextPromptParams {
  consensus: ConsensusForecast;
  city: string;
  language: string;
  /** Landmark resolved by the ResolveLandmark pipeline step. */
  landmark: string;
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
          .map((h, i) => `${i + 1}. ${h.slice(0, HISTORY_EXCERPT_LENGTH)}`)
          .join('\n')}`
      : '';

  const system = `You are a witty, culturally-aware weather reporter writing for a fun weather app. Your forecasts feel personal and locally relevant.

Style guidelines:
- Friendly, witty, and genuinely informative tone
- You MUST reference this specific landmark: "${params.landmark}" — weave it naturally into your text
- Also reference cultural quirks or seasonal context for the city
- Include practical recommendations (what to wear, whether to carry an umbrella, etc.)
- Write exactly 2–3 paragraphs, conversational style
- Avoid weather clichés ("April showers", "under the weather", etc.)
- Respond entirely in the requested language — use natural idioms, not a direct translation
- Never use markdown formatting${historySection}`;

  const consensus = params.consensus;
  const disagreementNote =
    consensus.disagreements.length > 0
      ? `\n- Note: Weather models partially disagree on: ${consensus.disagreements.join(', ')}`
      : '';

  const user = `Write a funny weather forecast for ${params.city} in language "${params.language}".

Current conditions (${consensus.confidence} confidence, ${consensus.providerCount} source${consensus.providerCount !== 1 ? 's' : ''}):
- Temperature: ${consensus.temperature}°C (feels like ${consensus.feelsLike}°C)
- Condition: ${consensus.condition} — ${consensus.conditionDescription}
- Humidity: ${consensus.humidity}%
- Wind: ${consensus.windSpeed} km/h ${consensus.windDirection}
- Precipitation: ${consensus.precipitation} mm
- UV index: ${consensus.uvIndex}
- Sunrise: ${consensus.sunrise} / Sunset: ${consensus.sunset}${disagreementNote}

Write 2–3 paragraphs in ${params.language}. Return only the forecast text, no JSON, no markdown.`;

  return { system, user };
}

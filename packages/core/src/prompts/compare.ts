/**
 * Prompt template for Agent 1 — Weather Comparison.
 *
 * Accepts 2–3 UnifiedWeatherData objects from different providers and asks
 * Bedrock Claude 3.5 Haiku to compute a single ConsensusForecast JSON.
 */
import type { UnifiedWeatherData } from '../types/weather.js';

export interface ComparePromptParams {
  providers: UnifiedWeatherData[];
}

export function buildComparePrompt(params: ComparePromptParams): {
  system: string;
  user: string;
} {
  const system = `You are a meteorological data analyst. Compare weather data from multiple providers and return a single consensus forecast as a JSON object.

Rules:
1. Compute weighted averages for numeric fields (temperature, feelsLike, humidity, windSpeed, precipitation, uvIndex, pressure, visibility). Use equal weights unless a provider is a clear outlier.
2. For windDirection: use the most common value; if all differ, use the average compass direction.
3. For condition: pick the value that best represents consensus. If 2+ providers agree, use that. If all differ, prefer the more cautious/severe condition.
4. Flag significant disagreements in the "disagreements" array (e.g., temperature difference >5°C, conflicting main conditions).
5. Set "confidence": "high" if all numeric values agree within 10%, "low" if major disagreements exist, "medium" otherwise.
6. Use the city/country/date/sunrise/sunset from whichever provider has the most complete data.
7. Return ONLY valid JSON — no markdown, no explanation.

Required output schema (ConsensusForecast):
{
  "city": string,
  "country": string,
  "date": string,
  "temperature": number,
  "feelsLike": number,
  "humidity": number,
  "windSpeed": number,
  "windDirection": string,
  "condition": "sunny" | "partly_cloudy" | "cloudy" | "rain" | "snow" | "thunderstorm" | "fog" | "windy",
  "conditionDescription": string,
  "precipitation": number,
  "uvIndex": number,
  "pressure": number,
  "visibility": number,
  "sunrise": string,
  "sunset": string,
  "confidence": "high" | "medium" | "low",
  "providerCount": number,
  "disagreements": string[]
}`;

  const user = `Compare the following weather data from ${params.providers.length} provider(s) and return a ConsensusForecast JSON object:

${JSON.stringify(params.providers, null, 2)}

Return ONLY the JSON object.`;

  return { system, user };
}

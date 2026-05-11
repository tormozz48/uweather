/**
 * Prompt template for Agent 3 — Pixazo SDXL Image Generation.
 *
 * Builds a text prompt for Stable Diffusion XL v1.0 (via Pixazo) that renders
 * a semi-realistic cityscape featuring the city's most recognisable landmark,
 * styled to match current weather conditions and time of day.
 *
 * Design principles:
 * - Name the landmark explicitly — SDXL does not infer landmarks from city names alone
 * - Semi-realistic / cinematic style → much better landmark fidelity than cartoon
 * - Landmark + city name appear first — SDXL weights early tokens most heavily
 * - Negative prompt keeps "photorealistic" removed so realistic rendering is allowed
 */
import type { ConsensusForecast, WeatherCondition } from '../types/weather.js';
import type { TimeSlot } from '../utils/time.js';

export interface ImageGenPromptParams {
  consensus: ConsensusForecast;
  city: string;
  timeSlot: TimeSlot;
}

/**
 * Well-known landmarks keyed by lowercase city name.
 * Used to give SDXL an explicit subject instead of vague "iconic landmark".
 */
const CITY_LANDMARKS: Record<string, string> = {
  // Europe
  paris: 'Eiffel Tower',
  london: 'Big Ben and the Houses of Parliament',
  rome: 'the Colosseum',
  barcelona: 'the Sagrada Família',
  berlin: 'the Brandenburg Gate',
  amsterdam: 'narrow gabled canal houses along a canal',
  prague: 'Charles Bridge and Prague Castle',
  vienna: "St. Stephen's Cathedral (Stephansdom)",
  madrid: 'the Royal Palace of Madrid',
  lisbon: 'the Belém Tower',
  athens: 'the Parthenon on the Acropolis',
  budapest: 'the Hungarian Parliament Building on the Danube',
  stockholm: 'Stockholm City Hall',
  copenhagen: 'Nyhavn colourful harbour houses',
  brussels: 'the Grand Place town hall',
  zurich: 'Grossmünster cathedral with the lake',
  milan: 'the Milan Cathedral (Duomo di Milano)',
  florence: "Florence Cathedral with Brunelleschi's Dome",
  venice: "St. Mark's Basilica and the Grand Canal",
  warsaw: 'Warsaw Old Town Market Place',
  kyiv: 'St. Sophia Cathedral',
  moscow: 'Saint Basil Cathedral on Red Square',
  istanbul: 'Hagia Sophia',
  // Americas
  'new york': 'the Statue of Liberty with the Manhattan skyline',
  'new york city': 'the Statue of Liberty with the Manhattan skyline',
  nyc: 'the Statue of Liberty with the Manhattan skyline',
  'los angeles': 'the Hollywood Sign and Griffith Observatory',
  chicago: 'the Willis Tower and Cloud Gate (Bean) skyline',
  'san francisco': 'the Golden Gate Bridge',
  miami: 'Art Deco hotels on Ocean Drive',
  toronto: 'the CN Tower',
  vancouver: 'Canada Place sails with the North Shore mountains',
  montreal: 'Notre-Dame Basilica of Montréal',
  'rio de janeiro': 'Christ the Redeemer on Corcovado mountain',
  'buenos aires': 'Casa Rosada presidential palace',
  'mexico city': 'the Angel of Independence monument',
  // Asia-Pacific
  tokyo: 'Tokyo Tower with Mount Fuji in the background',
  kyoto: 'Fushimi Inari Taisha red torii gates',
  osaka: 'Osaka Castle',
  beijing: 'the Forbidden City and Tiananmen Gate',
  shanghai: 'the Oriental Pearl Tower and Pudong skyline',
  'hong kong': 'Victoria Harbour skyline with the Bank of China Tower',
  singapore: 'Marina Bay Sands and Gardens by the Bay',
  seoul: 'Gyeongbokgung Palace with N Seoul Tower',
  bangkok: 'Wat Arun Temple of Dawn on the Chao Phraya River',
  dubai: 'the Burj Khalifa dominating the modern skyline',
  sydney: 'the Sydney Opera House and Harbour Bridge',
  melbourne: 'Flinders Street Station',
  mumbai: 'the Gateway of India',
  delhi: 'India Gate',
  // Middle East & Africa
  cairo: 'the Great Pyramid of Giza and the Sphinx',
  'cape town': 'Table Mountain with the city below',
  nairobi: 'Nairobi skyline with acacia trees in the foreground',
};

const TIME_SLOT_LIGHT: Record<TimeSlot, string> = {
  morning: 'golden sunrise glow, warm soft morning light, long shadows',
  afternoon: 'bright midday sunlight, vivid colours, crisp shadows',
  evening: 'warm orange and pink sunset sky, magic-hour lighting',
  night: 'dark sky with glowing city lights, moonlight, reflections on wet surfaces',
};

const CONDITION_VISUALS: Record<WeatherCondition, string> = {
  sunny: 'brilliant sunshine, crystal-clear blue sky',
  partly_cloudy: 'fluffy white clouds drifting across a blue sky, patches of golden sunlight',
  cloudy: 'solid grey overcast sky, soft diffused lighting',
  rain: 'rain falling in visible streaks, wet shiny streets, puddles, colourful umbrellas',
  snow: 'gentle snow falling, white-covered rooftops and streets, frost on windows',
  thunderstorm:
    'dramatic dark storm clouds, lightning bolt in the distance, heavy rain, wind-bent trees',
  fog: 'thick morning fog rolling through the streets, muted ethereal colours, mysterious silhouettes',
  windy: 'trees and flags bending in strong wind, leaves swirling, dynamic dramatic sky',
};

/** Return a named landmark for known cities, or a sensible fallback. */
function resolveLandmark(city: string): string {
  const key = city.toLowerCase().trim();
  return CITY_LANDMARKS[key] ?? `the most iconic landmark of ${city}`;
}

export function buildImageGenPrompt(params: ImageGenPromptParams): string {
  const landmark = resolveLandmark(params.city);
  const timeDesc = TIME_SLOT_LIGHT[params.timeSlot];
  const conditionDesc = CONDITION_VISUALS[params.consensus.condition];
  const temp = params.consensus.temperature;

  return (
    `${landmark} in ${params.city}, ${conditionDesc}, ${timeDesc}. ` +
    `Weather: ${params.consensus.conditionDescription}, ${temp}°C. ` +
    `Semi-realistic cinematic digital painting, detailed architecture, ` +
    `vivid colours, atmospheric depth, wide landscape composition. ` +
    `High quality, 8K render, no text, no labels, no watermarks.`
  );
}

export function buildImageGenNegativePrompt(): string {
  return (
    'text, labels, watermark, signature, blurry, low quality, distorted, ugly, ' +
    'cartoon, anime, flat illustration, sketch, painting, abstract, ' +
    'wrong landmark, generic skyline, unrecognisable buildings'
  );
}

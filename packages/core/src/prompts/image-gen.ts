/**
 * Prompt template for Agent 3 — Titan Image Generation.
 *
 * Builds a text prompt for Amazon Titan Image Generator v2 that describes a
 * stylized city skyline illustration matching the current weather conditions
 * and time of day.
 */
import type { ConsensusForecast, WeatherCondition } from '../types/weather.js';
import type { TimeSlot } from '../utils/time.js';

export interface ImageGenPromptParams {
  consensus: ConsensusForecast;
  city: string;
  timeSlot: TimeSlot;
}

const TIME_SLOT_LIGHT: Record<TimeSlot, string> = {
  morning: 'golden sunrise glow, warm soft morning light, long shadows',
  afternoon: 'bright midday sunlight, vivid colours, crisp shadows',
  evening: 'warm orange and pink sunset sky, magic-hour lighting',
  night: 'dark sky with glowing city lights, moonlight, reflections on wet surfaces',
};

const CONDITION_VISUALS: Record<WeatherCondition, string> = {
  sunny: 'brilliant sunshine, crystal-clear blue sky, no clouds',
  partly_cloudy: 'fluffy white clouds drifting across a blue sky, patches of golden sunlight',
  cloudy: 'solid grey overcast sky, muted soft lighting, no direct sun',
  rain: 'rain falling in visible streaks, wet shiny streets, puddles, people with colourful umbrellas',
  snow: 'gentle snow falling, white-covered rooftops and streets, frost on windows',
  thunderstorm:
    'dramatic dark purple storm clouds, lightning bolt in the distance, heavy rain, wind-bent trees',
  fog: 'thick morning fog rolling through streets, muted ethereal colours, mysterious silhouettes',
  windy: 'trees and flags bending in strong wind, leaves swirling, dynamic dramatic sky',
};

export function buildImageGenPrompt(params: ImageGenPromptParams): string {
  const timeDesc = TIME_SLOT_LIGHT[params.timeSlot];
  const conditionDesc = CONDITION_VISUALS[params.consensus.condition];
  const temp = params.consensus.temperature;

  return `A vibrant stylized digital illustration of ${params.city} city skyline with its iconic landmark. ${conditionDesc}. ${timeDesc}. Temperature ${temp}°C, ${params.consensus.conditionDescription}. Art style: colourful friendly cartoon illustration, slightly whimsical, suitable for a weather app. Wide landscape format. High quality, detailed, no text or labels.`;
}

export function buildImageGenNegativePrompt(): string {
  return 'text, labels, watermark, signature, blurry, low quality, distorted, ugly, dark, depressing, photorealistic';
}

/**
 * Prompt template for Agent 3 — Pixazo SDXL Image Generation.
 *
 * Builds a text prompt for Stable Diffusion XL v1.0 (via Pixazo) that renders
 * a semi-realistic cityscape featuring a landmark for the city,
 * styled to match current weather conditions and time of day.
 *
 * The landmark is resolved dynamically by the ResolveLandmark step upstream
 * (Wikidata SPARQL → Bedrock Haiku fallback).
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
  /** Landmark resolved by the ResolveLandmark pipeline step. */
  landmark: string;
}

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

export function buildImageGenPrompt(params: ImageGenPromptParams): string {
  const timeDesc = TIME_SLOT_LIGHT[params.timeSlot];
  const conditionDesc = CONDITION_VISUALS[params.consensus.condition];
  const temp = params.consensus.temperature;

  return `${params.landmark} in ${params.city}, ${conditionDesc}, ${timeDesc}. Weather: ${params.consensus.conditionDescription}, ${temp}°C. Semi-realistic cinematic digital painting, detailed architecture, vivid colours, atmospheric depth, wide landscape composition. High quality, 8K render, no text, no labels, no watermarks.`;
}

export function buildImageGenNegativePrompt(): string {
  return (
    'text, labels, watermark, signature, blurry, low quality, distorted, ugly, ' +
    'cartoon, anime, flat illustration, sketch, painting, abstract, ' +
    'wrong landmark, generic skyline, unrecognisable buildings'
  );
}

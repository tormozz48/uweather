/**
 * Prompt template for the ResolveLandmark step — Bedrock Haiku fallback.
 *
 * Used when Wikidata SPARQL returns fewer than MIN_LANDMARKS results for a city.
 * Asks Claude Haiku to produce a JSON array of visually distinctive landmarks
 * suitable for SDXL image generation prompts.
 */

export interface ResolveLandmarkPromptParams {
  city: string;
}

export function buildResolveLandmarkPrompt(params: ResolveLandmarkPromptParams): {
  system: string;
  user: string;
} {
  const system = `You are a geography expert. Return ONLY a JSON array of strings — no markdown, no explanation, no wrapper object.

Each string should be a short (3–12 word) description of a visually distinctive, well-known landmark in the requested city. Focus on landmarks that:
- Are architecturally or visually striking (good for image generation)
- Are widely recognised (a text-to-image model is likely to render them correctly)
- Include the landmark's proper name

Return 5–10 landmarks. If the city has fewer than 5 well-known landmarks, include notable natural features, famous streets, or iconic districts.`;

  const user = `List visually distinctive landmarks in ${params.city}. Return a JSON array of strings only.`;

  return { system, user };
}

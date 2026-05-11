import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { buildResolveLandmarkPrompt, createLogger, emitMetric } from '@uweather/core';
import type { Context } from 'aws-lambda';

const bedrock = new BedrockRuntimeClient({});
const log = createLogger({ function: 'resolve-landmark' });

const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

/**
 * Wikidata SPARQL endpoint — free, no API key required.
 * Returns tourist attractions, monuments, and notable buildings for a city.
 */
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

/** Minimum landmarks from Wikidata before we fall back to Bedrock. */
const MIN_LANDMARKS = 3;

export interface ResolveLandmarkInput {
  city: string;
}

export interface ResolveLandmarkOutput {
  landmark: string;
  landmarksList: string[];
  source: 'wikidata' | 'bedrock';
}

/**
 * Build a SPARQL query that finds visually distinctive landmarks in a city.
 *
 * Strategy: search for items that are tourist attractions, monuments, buildings,
 * or architectural structures located in (P131) a place whose label matches the
 * city name. We fetch English labels and limit to 15 results.
 */
function buildSparqlQuery(city: string): string {
  // Escape single quotes in city name for SPARQL string literal
  const escaped = city.replace(/'/g, "\\'");

  return `
SELECT DISTINCT ?itemLabel WHERE {
  # Find the city entity by English label
  ?city rdfs:label "${escaped}"@en .

  # The city should be an instance of city, big city, capital, etc.
  ?city wdt:P31/wdt:P279* wd:Q515 .

  # Find items located in this city (or its admin subdivisions)
  ?item wdt:P131+ ?city .

  # Filter to visually interesting categories:
  # tourist attraction (Q570116), monument (Q4989906), building (Q41176),
  # architectural structure (Q811979), bridge (Q12280), statue (Q179700),
  # church building (Q16970), museum (Q33506), park (Q22698)
  VALUES ?type {
    wd:Q570116 wd:Q4989906 wd:Q41176 wd:Q811979
    wd:Q12280  wd:Q179700  wd:Q16970 wd:Q33506 wd:Q22698
  }
  ?item wdt:P31/wdt:P279* ?type .

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 15`;
}

/** Query Wikidata SPARQL and return a list of landmark names. */
async function fetchFromWikidata(city: string): Promise<string[]> {
  const query = buildSparqlQuery(city);
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'uweather-bot/1.0 (https://github.com/uweather)',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    results: {
      bindings: Array<{ itemLabel: { value: string } }>;
    };
  };

  return data.results.bindings
    .map((b) => b.itemLabel.value)
    .filter((label) => {
      // Wikidata sometimes returns Q-identifiers when no English label exists
      return !label.startsWith('Q') || !/^Q\d+$/.test(label);
    });
}

/** Call Bedrock Claude Haiku to generate a list of landmarks for a city. */
async function fetchFromBedrock(city: string): Promise<string[]> {
  const { system, user } = buildResolveLandmarkPrompt({ city });

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    }),
  );

  const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = responseBody.content.find((c) => c.type === 'text')?.text?.trim() ?? '[]';

  // Parse the JSON array — Haiku sometimes wraps in markdown code fences
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned) as unknown;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Bedrock returned invalid landmarks array');
  }

  return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

/** Pick a random element from an array. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * ResolveLandmark Lambda — Step Functions task.
 *
 * Resolves a list of visually distinctive landmarks for a city, then picks
 * one at random. The selected landmark is threaded into both Agent 2 (funny text)
 * and Agent 3 (image generation).
 *
 * Strategy:
 *   1. Query Wikidata SPARQL (free, no API key) for landmarks
 *   2. If fewer than MIN_LANDMARKS results, fall back to Bedrock Claude Haiku
 *   3. Pick one landmark at random from the list
 */
export async function handler(
  input: ResolveLandmarkInput,
  context: Context,
): Promise<ResolveLandmarkOutput> {
  const reqLog = log.child({ requestId: context.awsRequestId, city: input.city });
  reqLog.info('ResolveLandmark starting');

  let landmarks: string[] = [];
  let source: 'wikidata' | 'bedrock' = 'wikidata';

  // 1. Try Wikidata SPARQL first
  try {
    landmarks = await reqLog.timed('Wikidata SPARQL query', () => fetchFromWikidata(input.city));
    reqLog.info('Wikidata returned landmarks', { count: landmarks.length });
    emitMetric('WikidataLandmarkCount', landmarks.length, 'Count', { city: input.city });
  } catch (err) {
    reqLog.warn('Wikidata query failed (will fall back to Bedrock)', {
      error: err instanceof Error ? err.message : String(err),
    });
    emitMetric('WikidataLandmarkError', 1, 'Count', { city: input.city });
  }

  // 2. Fall back to Bedrock if Wikidata didn't return enough
  if (landmarks.length < MIN_LANDMARKS) {
    reqLog.info('Falling back to Bedrock Haiku for landmarks', {
      wikidataCount: landmarks.length,
      minRequired: MIN_LANDMARKS,
    });
    source = 'bedrock';

    try {
      const bedrockStart = Date.now();
      landmarks = await fetchFromBedrock(input.city);
      const durationMs = Date.now() - bedrockStart;
      emitMetric('BedrockLatency', durationMs, 'Milliseconds', { agent: 'resolve-landmark' });
      reqLog.info('Bedrock returned landmarks', { count: landmarks.length, durationMs });
    } catch (err) {
      reqLog.error('Bedrock landmark fallback failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Last resort: generic fallback
      landmarks = [`the most iconic landmark of ${input.city}`];
      source = 'bedrock';
    }
  }

  const landmark = pickRandom(landmarks);
  reqLog.info('Landmark selected', { landmark, source, totalOptions: landmarks.length });
  emitMetric('LandmarkSource', 1, 'Count', { source });

  return { landmark, landmarksList: landmarks, source };
}

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import {
  buildResolveLandmarkPrompt,
  createLogger,
  emitMetric,
  stripMarkdownFence,
} from '@uweather/core';
import type { Context } from 'aws-lambda';
import { reportStage } from '../lib/report-stage.js';

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

/** Timeout for Wikidata SPARQL HTTP requests. */
const WIKIDATA_QUERY_TIMEOUT_MS = 8000;

/** Max tokens for Bedrock landmark generation (shorter than text agents — just a JSON array). */
const BEDROCK_LANDMARK_MAX_TOKENS = 512;

export interface ResolveLandmarkInput {
  city: string;
  executionArn?: string;
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
    signal: AbortSignal.timeout(WIKIDATA_QUERY_TIMEOUT_MS),
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
        max_tokens: BEDROCK_LANDMARK_MAX_TOKENS,
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
  const cleaned = stripMarkdownFence(text);
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

type ReqLog = ReturnType<typeof log.child>;

/**
 * Attempt to fetch landmarks from Wikidata SPARQL.
 * Returns an empty array (and emits a metric) on any failure so the caller
 * can fall through to the Bedrock path without additional try/catch logic.
 */
async function tryWikidataLandmarks(city: string, reqLog: ReqLog): Promise<string[]> {
  try {
    const landmarks = await reqLog.timed('Wikidata SPARQL query', () => fetchFromWikidata(city));
    reqLog.info('Wikidata returned landmarks', { count: landmarks.length });
    emitMetric('WikidataLandmarkCount', landmarks.length, 'Count', { city });
    return landmarks;
  } catch (err) {
    reqLog.warn('Wikidata query failed (will fall back to Bedrock)', {
      error: err instanceof Error ? err.message : String(err),
    });
    emitMetric('WikidataLandmarkError', 1, 'Count', { city });
    return [];
  }
}

/**
 * Fetch landmarks from Bedrock Claude Haiku.
 * Returns a single generic landmark string on failure so the pipeline always
 * has something to work with (last-resort fallback).
 */
async function tryBedrockLandmarks(city: string, reqLog: ReqLog): Promise<string[]> {
  try {
    const start = Date.now();
    const landmarks = await fetchFromBedrock(city);
    const durationMs = Date.now() - start;
    emitMetric('BedrockLatency', durationMs, 'Milliseconds', { agent: 'resolve-landmark' });
    reqLog.info('Bedrock returned landmarks', { count: landmarks.length, durationMs });
    return landmarks;
  } catch (err) {
    reqLog.error('Bedrock landmark fallback failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [`the most iconic landmark of ${city}`];
  }
}

/**
 * Resolve a list of visually distinctive landmarks for a city.
 *
 * Strategy:
 *   1. Query Wikidata SPARQL (free, no API key)
 *   2. Fall back to Bedrock Claude Haiku if fewer than MIN_LANDMARKS returned
 */
async function resolveLandmarks(
  city: string,
  reqLog: ReqLog,
): Promise<{ landmarks: string[]; source: 'wikidata' | 'bedrock' }> {
  const wikidataLandmarks = await tryWikidataLandmarks(city, reqLog);

  if (wikidataLandmarks.length >= MIN_LANDMARKS) {
    return { landmarks: wikidataLandmarks, source: 'wikidata' };
  }

  reqLog.info('Falling back to Bedrock Haiku for landmarks', {
    wikidataCount: wikidataLandmarks.length,
    minRequired: MIN_LANDMARKS,
  });

  const bedrockLandmarks = await tryBedrockLandmarks(city, reqLog);
  return { landmarks: bedrockLandmarks, source: 'bedrock' };
}

/**
 * ResolveLandmark Lambda — Step Functions task.
 *
 * Resolves a list of visually distinctive landmarks for a city, then picks
 * one at random. The selected landmark is threaded into both Agent 2 (funny text)
 * and Agent 3 (image generation).
 */
export async function handler(
  input: ResolveLandmarkInput,
  context: Context,
): Promise<ResolveLandmarkOutput> {
  const reqLog = log.child({ requestId: context.awsRequestId, city: input.city });
  if (input.executionArn) await reportStage(input.executionArn, 'landmark', 'started');
  reqLog.info('ResolveLandmark starting');

  const { landmarks, source } = await resolveLandmarks(input.city, reqLog);

  const landmark = pickRandom(landmarks);
  reqLog.info('Landmark selected', { landmark, source, totalOptions: landmarks.length });
  emitMetric('LandmarkSource', 1, 'Count', { source });

  if (input.executionArn) await reportStage(input.executionArn, 'landmark', 'done');
  return { landmark, landmarksList: landmarks, source };
}

import { buildFunnyTextPrompt, createLogger } from '@uweather/core';
import type { ConsensusForecast } from '@uweather/core';
import type { Context } from 'aws-lambda';
import { callBedrock } from '../lib/bedrock.js';
import { reportStage } from '../lib/report-stage.js';
import { forecastService } from '../services/index.js';

const log = createLogger({ function: 'agent-funny-text' });

const MAX_HISTORY_ITEMS = 5;

export interface FunnyTextInput {
  city: string;
  language: string;
  date: string;
  consensus: ConsensusForecast;
  /** Landmark resolved by the ResolveLandmark pipeline step. */
  landmark: string;
  executionArn?: string;
}

export interface FunnyTextOutput {
  funnyText: string;
}

/**
 * Agent 2 — Funny Localized Text Lambda.
 *
 * Step Functions task: invoked after Agent 1 (compare). Takes the
 * ConsensusForecast, queries recent forecast history for this city to avoid
 * repetition, then calls Bedrock Claude Haiku to generate a 2–3 paragraph
 * humorous weather report in the requested language.
 */
export async function handler(input: FunnyTextInput, context: Context): Promise<FunnyTextOutput> {
  const reqLog = log.child({
    requestId: context.awsRequestId,
    city: input.city,
    language: input.language,
  });
  if (input.executionArn) await reportStage(input.executionArn, 'text', 'started');
  reqLog.info('Agent2_FunnyText starting');

  // Fetch recent history for this city to avoid repetition
  const recentHistory = await fetchRecentHistory(input.city, input.language, reqLog);
  reqLog.info('Fetched recent history', { count: recentHistory.length });

  const { system, user } = buildFunnyTextPrompt({
    consensus: input.consensus,
    city: input.city,
    language: input.language,
    landmark: input.landmark,
    recentHistory,
  });

  const funnyText = (await callBedrock({ system, user, agent: 'funny-text', log: reqLog })).trim();

  if (!funnyText) {
    throw new Error('Agent2_FunnyText: Bedrock returned empty text');
  }

  reqLog.info('Funny text generated', { length: funnyText.length });

  if (input.executionArn) await reportStage(input.executionArn, 'text', 'done');
  return { funnyText };
}

/**
 * Query the last N funny texts for this city+language from the Forecasts table
 * via the UserHistoryIndex GSI.
 */
async function fetchRecentHistory(
  city: string,
  language: string,
  reqLog: ReturnType<ReturnType<typeof createLogger>['child']>,
): Promise<string[]> {
  try {
    return await forecastService.listRecentFunnyTexts(city, language, MAX_HISTORY_ITEMS);
  } catch (err) {
    // History is best-effort — don't fail the pipeline if it can't be fetched
    reqLog.warn('Failed to fetch recent history (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

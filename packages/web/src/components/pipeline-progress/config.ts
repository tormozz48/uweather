/**
 * Pipeline progress configuration — types, layout definition, and pure
 * status helpers. No JSX, no side effects; safe to import anywhere.
 */
import type { PipelineStageId } from '@uweather/core';
import type { StageStatus } from '../../hooks/usePipelineProgress.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StageNodeDef {
  readonly id: string;
  readonly label: string;
  readonly stageIds: PipelineStageId[];
}

export interface SequentialRow {
  readonly type: 'sequential';
  readonly stage: StageNodeDef;
}

export interface ParallelRow {
  readonly type: 'parallel';
  readonly groupLabel: string;
  readonly stages: StageNodeDef[];
}

export type PipelineRow = SequentialRow | ParallelRow;

// ── Layout ─────────────────────────────────────────────────────────────────────
//
// Mirrors the Step Functions state machine:
//   CheckCache → FetchWeather(Parallel×3) → Agent1_Compare
//     → ResolveLandmark → ParallelAgents(Text + Image) → SaveForecast

export const PIPELINE_LAYOUT: PipelineRow[] = [
  {
    type: 'sequential',
    stage: { id: 'cache', label: 'Cache', stageIds: ['cache'] },
  },
  {
    type: 'parallel',
    groupLabel: 'Fetch',
    stages: [
      { id: 'fetch_ow', label: 'OpenWeather', stageIds: ['fetch_openweather'] },
      { id: 'fetch_wa', label: 'WeatherAPI', stageIds: ['fetch_weatherapi'] },
      { id: 'fetch_om', label: 'Open-Meteo', stageIds: ['fetch_openmeteo'] },
    ],
  },
  {
    type: 'sequential',
    stage: { id: 'compare', label: 'Compare', stageIds: ['compare'] },
  },
  {
    type: 'sequential',
    stage: { id: 'landmark', label: 'Landmark', stageIds: ['landmark'] },
  },
  {
    type: 'parallel',
    groupLabel: 'Parallel',
    stages: [
      { id: 'text', label: 'Text', stageIds: ['text'] },
      { id: 'image', label: 'Image', stageIds: ['image_cache', 'image_gen'] },
    ],
  },
  {
    type: 'sequential',
    stage: { id: 'save', label: 'Save', stageIds: ['save'] },
  },
];

// ── Status helpers ─────────────────────────────────────────────────────────────

/**
 * Derive visual status from a set of pipeline stage IDs.
 * Returns 'done' only when every sub-stage is done,
 * 'active' when any sub-stage is active or done, else 'pending'.
 */
export function deriveNodeStatus(
  stageIds: PipelineStageId[],
  stages: Record<PipelineStageId, StageStatus>,
): StageStatus {
  const statuses = stageIds.map((stageId) => stages[stageId]);
  if (statuses.every((status) => status === 'done')) return 'done';
  if (statuses.some((status) => status === 'active' || status === 'done')) return 'active';
  return 'pending';
}

/** Collapse all sub-stages of a row into a single visual status. */
export function deriveRowStatus(
  row: PipelineRow,
  stages: Record<PipelineStageId, StageStatus>,
): StageStatus {
  const stageIds =
    row.type === 'sequential'
      ? row.stage.stageIds
      : row.stages.flatMap((stageDef) => stageDef.stageIds);
  return deriveNodeStatus(stageIds, stages);
}

/** Progress percentage: fraction of raw pipeline stage IDs that are done. */
export function computeProgressPct(stages: Record<PipelineStageId, StageStatus>): number {
  const values = Object.values(stages);
  if (values.length === 0) return 0;
  const doneCount = values.filter((status) => status === 'done').length;
  return Math.round((doneCount / values.length) * 100);
}

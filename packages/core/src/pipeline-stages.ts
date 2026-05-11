/**
 * Pipeline stage definitions shared between backend (event emitters)
 * and frontend (progress visualization).
 *
 * Each stage ID maps to a Step Functions state (or group of states).
 * The frontend uses these IDs to drive the animated pipeline diagram.
 */

/** All possible pipeline stage identifiers. */
export type PipelineStageId =
  | 'cache'
  | 'fetch_openweather'
  | 'fetch_weatherapi'
  | 'fetch_openmeteo'
  | 'compare'
  | 'landmark'
  | 'text'
  | 'image_cache'
  | 'image_gen'
  | 'save';

/** Message pushed to the client over WebSocket. */
export interface StageProgressMessage {
  type: 'stage';
  stage: PipelineStageId;
  status: 'started' | 'done';
  timestamp: string; // ISO 8601
}

/** Completion message pushed when the pipeline finishes. */
export interface PipelineCompleteMessage {
  type: 'complete';
  status: 'succeeded' | 'failed';
  timestamp: string;
}

/** Union of all WebSocket message types. */
export type PipelineWsMessage = StageProgressMessage | PipelineCompleteMessage;

/**
 * Simplified stages for the frontend diagram.
 * Individual fetch providers and image sub-stages are grouped
 * into higher-level visual stages.
 */
export interface VisualStage {
  id: string;
  label: string;
  icon: string;
  /** Stage IDs from PipelineStageId that map to this visual stage. */
  stageIds: PipelineStageId[];
  /** Whether this visual stage runs in parallel with siblings. */
  parallel?: boolean;
}

export const VISUAL_STAGES: VisualStage[] = [
  { id: 'cache', label: 'Cache', icon: '🔍', stageIds: ['cache'] },
  {
    id: 'fetch',
    label: 'Fetch',
    icon: '🌤️',
    stageIds: ['fetch_openweather', 'fetch_weatherapi', 'fetch_openmeteo'],
  },
  { id: 'compare', label: 'Compare', icon: '🧠', stageIds: ['compare'] },
  { id: 'landmark', label: 'Landmark', icon: '📍', stageIds: ['landmark'] },
  { id: 'text', label: 'Text', icon: '✍️', stageIds: ['text'], parallel: true },
  {
    id: 'image',
    label: 'Image',
    icon: '🎨',
    stageIds: ['image_cache', 'image_gen'],
    parallel: true,
  },
  { id: 'save', label: 'Save', icon: '💾', stageIds: ['save'] },
];

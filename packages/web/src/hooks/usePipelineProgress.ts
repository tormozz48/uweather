/**
 * usePipelineProgress — React hook for real-time pipeline stage tracking.
 *
 * Opens a WebSocket to the pipeline progress API when an executionArn is
 * provided. Receives StageProgress and PipelineComplete messages, and
 * maintains a map of stage states (pending → active → done).
 *
 * Falls back gracefully if WebSocket connection fails — the caller should
 * still poll for the result via the REST API.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PipelineStageId, PipelineWsMessage } from '@uweather/core';
import { WS_URL } from '../api.js';

export type StageStatus = 'pending' | 'active' | 'done';

export interface PipelineProgressState {
  /** Per-stage status map. */
  stages: Record<PipelineStageId, StageStatus>;
  /** Whether the pipeline has finished (succeeded or failed). */
  completed: boolean;
  /** Whether the pipeline succeeded. */
  succeeded: boolean;
  /** Whether the WebSocket is connected. */
  connected: boolean;
}

const ALL_STAGES: PipelineStageId[] = [
  'cache',
  'fetch_openweather',
  'fetch_weatherapi',
  'fetch_openmeteo',
  'compare',
  'landmark',
  'text',
  'image_cache',
  'image_gen',
  'save',
];

function initialStages(): Record<PipelineStageId, StageStatus> {
  const stages = {} as Record<PipelineStageId, StageStatus>;
  for (const id of ALL_STAGES) stages[id] = 'pending';
  return stages;
}

export function usePipelineProgress(executionArn: string | null): PipelineProgressState {
  const [state, setState] = useState<PipelineProgressState>({
    stages: initialStages(),
    completed: false,
    succeeded: false,
    connected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as PipelineWsMessage;

      if (msg.type === 'stage') {
        setState((prev) => ({
          ...prev,
          stages: {
            ...prev.stages,
            [msg.stage]: msg.status === 'started' ? 'active' : 'done',
          },
        }));
      } else if (msg.type === 'complete') {
        setState((prev) => ({
          ...prev,
          completed: true,
          succeeded: msg.status === 'succeeded',
        }));
      }
    } catch {
      // Ignore malformed messages
    }
  }, []);

  useEffect(() => {
    if (!executionArn || !WS_URL) return;

    // Reset state for new execution
    setState({
      stages: initialStages(),
      completed: false,
      succeeded: false,
      connected: false,
    });

    const url = `${WS_URL}?executionArn=${encodeURIComponent(executionArn)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      // WebSocket errors are non-fatal — the REST polling fallback handles it
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [executionArn, handleMessage]);

  return state;
}

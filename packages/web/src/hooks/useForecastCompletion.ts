/**
 * useForecastCompletion — runs when the pipeline WebSocket signals completion.
 *
 * Fetches the forecast result on success, or transitions to an error state on
 * failure. Guards against double-fires via an internal ref.
 */
import { useEffect, useRef } from 'react';
import type { ForecastResponse } from '../api.js';
import { pollForecastResult } from '../api.js';

interface PipelineProgress {
  completed: boolean;
  succeeded: boolean;
}

interface LoadingState {
  status: 'loading';
  executionArn: string;
}

interface UseForecastCompletionParams {
  progress: PipelineProgress;
  state: { status: string; executionArn?: string };
  onSuccess: (forecast: ForecastResponse) => void;
  onError: (message: string) => void;
}

/**
 * Watches pipeline WebSocket progress and fetches the result when the pipeline
 * completes. Calls `onSuccess` with the forecast or `onError` with a message.
 */
export function useForecastCompletion({
  progress,
  state,
  onSuccess,
  onError,
}: UseForecastCompletionParams): void {
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!progress.completed || state.status !== 'loading') return;
    if (fetchingRef.current) return; // prevent double-fire
    fetchingRef.current = true;

    const executionArn = (state as LoadingState).executionArn;

    if (progress.succeeded) {
      pollForecastResult(executionArn)
        .then(onSuccess)
        .catch((err) => {
          onError(err instanceof Error ? err.message : 'Something went wrong.');
        })
        .finally(() => {
          fetchingRef.current = false;
        });
    } else {
      fetchingRef.current = false;
      onError('Forecast pipeline failed — please try again.');
    }
  }, [progress.completed, progress.succeeded, state, onSuccess, onError]);
}

/**
 * PipelineProgress — animated pipeline diagram showing real-time
 * Step Functions execution progress.
 *
 * Replaces the skeleton loader during forecast generation. Shows
 * simplified pipeline stages with CSS transitions between states:
 *   pending (dim) → active (blue pulse) → done (green ✓)
 */
import { VISUAL_STAGES } from '@uweather/core';
import type { PipelineStageId } from '@uweather/core';
import type { StageStatus } from '../hooks/usePipelineProgress.js';

interface Props {
  stages: Record<PipelineStageId, StageStatus>;
  connected: boolean;
}

/**
 * Derive the visual status of a grouped stage from its constituent
 * pipeline stage IDs. Done if ALL sub-stages are done, active if
 * ANY sub-stage is active, otherwise pending.
 */
function deriveVisualStatus(
  stageIds: PipelineStageId[],
  stages: Record<PipelineStageId, StageStatus>,
): StageStatus {
  const statuses = stageIds.map((id) => stages[id]);
  if (statuses.every((s) => s === 'done')) return 'done';
  if (statuses.some((s) => s === 'active' || s === 'done')) return 'active';
  return 'pending';
}

function StageNode({
  icon,
  label,
  status,
}: {
  icon: string;
  label: string;
  status: StageStatus;
}) {
  return (
    <div className={`pipeline-stage pipeline-stage--${status}`}>
      <span className="pipeline-stage__icon">{icon}</span>
      <span className="pipeline-stage__label">{label}</span>
      {status === 'done' && <span className="pipeline-stage__check">✓</span>}
      {status === 'active' && <span className="pipeline-stage__dot" />}
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <div className={`pipeline-connector ${done ? 'pipeline-connector--done' : ''}`}>
      <div className="pipeline-connector__line" />
      <div className="pipeline-connector__arrow" />
    </div>
  );
}

export function PipelineProgress({ stages, connected }: Props) {
  // Separate sequential and parallel stages
  const sequentialBefore = VISUAL_STAGES.filter(
    (s) => !s.parallel && ['cache', 'fetch', 'compare', 'landmark'].includes(s.id),
  );
  const parallelStages = VISUAL_STAGES.filter((s) => s.parallel);
  const sequentialAfter = VISUAL_STAGES.filter(
    (s) => !s.parallel && s.id === 'save',
  );

  const allVisualStatuses = VISUAL_STAGES.map((vs) => ({
    ...vs,
    status: deriveVisualStatus(vs.stageIds, stages),
  }));

  // Progress percentage for the bar
  const doneCount = allVisualStatuses.filter((s) => s.status === 'done').length;
  const progressPct = Math.round((doneCount / allVisualStatuses.length) * 100);

  return (
    <div className="pipeline-progress">
      <div className="pipeline-progress__header">
        <span className="pipeline-progress__title">Pipeline Progress</span>
        {connected && <span className="pipeline-progress__live">● LIVE</span>}
      </div>

      <div className="pipeline-progress__diagram">
        {/* Sequential stages before parallel */}
        <div className="pipeline-progress__row">
          {sequentialBefore.map((vs, i) => {
            const status = deriveVisualStatus(vs.stageIds, stages);
            const prevStatus = i > 0
              ? deriveVisualStatus(sequentialBefore[i - 1].stageIds, stages)
              : 'done';
            return (
              <div key={vs.id} className="pipeline-progress__step">
                {i > 0 && <Connector done={prevStatus === 'done'} />}
                <StageNode icon={vs.icon} label={vs.label} status={status} />
              </div>
            );
          })}
        </div>

        {/* Connector to parallel */}
        <div className="pipeline-progress__parallel-connector">
          <Connector
            done={deriveVisualStatus(
              sequentialBefore[sequentialBefore.length - 1].stageIds,
              stages,
            ) === 'done'}
          />
        </div>

        {/* Parallel stages */}
        <div className="pipeline-progress__parallel">
          <div className="pipeline-progress__parallel-bracket" />
          <div className="pipeline-progress__parallel-lanes">
            {parallelStages.map((vs) => (
              <StageNode
                key={vs.id}
                icon={vs.icon}
                label={vs.label}
                status={deriveVisualStatus(vs.stageIds, stages)}
              />
            ))}
          </div>
          <div className="pipeline-progress__parallel-label">parallel</div>
        </div>

        {/* Connector from parallel to save */}
        <div className="pipeline-progress__parallel-connector">
          <Connector
            done={parallelStages.every(
              (vs) => deriveVisualStatus(vs.stageIds, stages) === 'done',
            )}
          />
        </div>

        {/* Save stage */}
        <div className="pipeline-progress__row">
          {sequentialAfter.map((vs) => (
            <StageNode
              key={vs.id}
              icon={vs.icon}
              label={vs.label}
              status={deriveVisualStatus(vs.stageIds, stages)}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="pipeline-progress__bar-track">
        <div
          className="pipeline-progress__bar-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="pipeline-progress__hint">
        Consulting 3 weather services and generating a custom image…
      </p>
    </div>
  );
}

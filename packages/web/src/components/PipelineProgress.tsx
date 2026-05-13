/**
 * PipelineProgress — animated pipeline diagram showing real-time
 * Step Functions execution progress via WebSocket events.
 *
 * Stage nodes use MUI Chip (pending/active/done colour states).
 * Progress bar uses MUI LinearProgress.
 * Connector arrows keep their CSS classes (CSS triangle trick).
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
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
 * ANY sub-stage is active or done, otherwise pending.
 */
function deriveVisualStatus(
  stageIds: PipelineStageId[],
  stages: Record<PipelineStageId, StageStatus>,
): StageStatus {
  const statuses = stageIds.map((stageId) => stages[stageId]);
  if (statuses.every((status) => status === 'done')) return 'done';
  if (statuses.some((status) => status === 'active' || status === 'done')) return 'active';
  return 'pending';
}

function StageChip({ icon, label, status }: { icon: string; label: string; status: StageStatus }) {
  const chipLabel = status === 'done' ? `${label} ✓` : label;

  return (
    <Chip
      label={chipLabel}
      icon={<span style={{ fontSize: '0.9rem', marginLeft: 6 }}>{icon}</span>}
      size="small"
      color={status === 'done' ? 'success' : status === 'active' ? 'primary' : 'default'}
      variant={status === 'pending' ? 'outlined' : 'filled'}
      sx={{
        opacity: status === 'pending' ? 0.45 : 1,
        transition: 'all 0.4s ease',
        minWidth: 92,
        fontWeight: 600,
        fontSize: '0.75rem',
        animation: status === 'active' ? 'pipeline-pulse 1.5s ease-in-out infinite' : 'none',
      }}
    />
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <div className={`pipeline-connector${done ? ' pipeline-connector--done' : ''}`}>
      <div className="pipeline-connector__line" />
      <div className="pipeline-connector__arrow" />
    </div>
  );
}

export function PipelineProgress({ stages, connected }: Props) {
  const sequentialBefore = VISUAL_STAGES.filter(
    (stage) => !stage.parallel && ['cache', 'fetch', 'compare', 'landmark'].includes(stage.id),
  );
  const parallelStages = VISUAL_STAGES.filter((stage) => stage.parallel);
  const sequentialAfter = VISUAL_STAGES.filter((stage) => !stage.parallel && stage.id === 'save');

  const allVisualStatuses = VISUAL_STAGES.map((visualStage) => ({
    ...visualStage,
    status: deriveVisualStatus(visualStage.stageIds, stages),
  }));

  const doneCount = allVisualStatuses.filter((stage) => stage.status === 'done').length;
  const progressPct = Math.round((doneCount / allVisualStatuses.length) * 100);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ letterSpacing: '0.08em', lineHeight: 1 }}
        >
          Pipeline Progress
        </Typography>
        {connected && (
          <Chip
            label="● LIVE"
            size="small"
            color="success"
            variant="outlined"
            sx={{
              fontSize: '0.7rem',
              fontWeight: 700,
              height: 22,
              animation: 'pipeline-pulse 2s ease-in-out infinite',
            }}
          />
        )}
      </Box>

      {/* Diagram */}
      <Box
        className="pipeline-progress__diagram"
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
      >
        {/* Sequential stages before parallel */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {sequentialBefore.map((visualStage, index) => {
            const status = deriveVisualStatus(visualStage.stageIds, stages);
            const prevDone =
              index > 0
                ? deriveVisualStatus(sequentialBefore[index - 1].stageIds, stages) === 'done'
                : true;
            return (
              <Box key={visualStage.id} sx={{ display: 'flex', alignItems: 'center' }}>
                {index > 0 && <Connector done={prevDone} />}
                <StageChip icon={visualStage.icon} label={visualStage.label} status={status} />
              </Box>
            );
          })}
        </Box>

        {/* Connector → parallel */}
        <Box sx={{ transform: 'rotate(90deg)' }}>
          <Connector
            done={
              deriveVisualStatus(sequentialBefore[sequentialBefore.length - 1].stageIds, stages) ===
              'done'
            }
          />
        </Box>

        {/* Parallel section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 3,
              alignSelf: 'stretch',
              minHeight: 40,
              bgcolor: 'divider',
              borderRadius: 1,
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {parallelStages.map((visualStage) => (
              <StageChip
                key={visualStage.id}
                icon={visualStage.icon}
                label={visualStage.label}
                status={deriveVisualStatus(visualStage.stageIds, stages)}
              />
            ))}
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              writingMode: 'vertical-lr',
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              opacity: 0.6,
            }}
          >
            parallel
          </Typography>
        </Box>

        {/* Connector → save */}
        <Box sx={{ transform: 'rotate(90deg)' }}>
          <Connector
            done={parallelStages.every(
              (visualStage) => deriveVisualStatus(visualStage.stageIds, stages) === 'done',
            )}
          />
        </Box>

        {/* Save stage */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sequentialAfter.map((visualStage) => (
            <StageChip
              key={visualStage.id}
              icon={visualStage.icon}
              label={visualStage.label}
              status={deriveVisualStatus(visualStage.stageIds, stages)}
            />
          ))}
        </Box>
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progressPct}
        sx={{ borderRadius: 1, height: 4 }}
      />

      <Typography variant="caption" color="text.secondary" align="center">
        Consulting 3 weather services and generating a custom image…
      </Typography>
    </Box>
  );
}

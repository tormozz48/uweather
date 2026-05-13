import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { PipelineStageId } from '@uweather/core';
import type { StageStatus } from '../../hooks/usePipelineProgress.js';
import { deriveNodeStatus, type StageNodeDef } from './config.js';
import { StageChip } from './StageChip.js';

interface Props {
  groupLabel: string;
  stageDefs: StageNodeDef[];
  stages: Record<PipelineStageId, StageStatus>;
}

export function ParallelGroupRow({ groupLabel, stageDefs, stages }: Props) {
  const allStageIds = stageDefs.flatMap((stageDef) => stageDef.stageIds);
  const groupStatus = deriveNodeStatus(allStageIds, stages);
  const isPending = groupStatus === 'pending';

  return (
    <Box
      sx={{
        border: '1px dashed',
        borderColor: isPending ? 'divider' : 'primary.main',
        borderRadius: 2,
        px: 1.5,
        py: 1,
        position: 'relative',
        transition: 'border-color 0.4s ease, opacity 0.4s ease',
        opacity: isPending ? 0.5 : 1,
        zIndex: 1,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          top: -9,
          left: 10,
          bgcolor: 'background.paper',
          px: 0.75,
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: isPending ? 'text.disabled' : 'primary.main',
          transition: 'color 0.4s ease',
        }}
      >
        {groupLabel}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {stageDefs.map((stageDef) => (
          <StageChip
            key={stageDef.id}
            id={stageDef.id}
            label={stageDef.label}
            status={deriveNodeStatus(stageDef.stageIds, stages)}
          />
        ))}
      </Box>
    </Box>
  );
}

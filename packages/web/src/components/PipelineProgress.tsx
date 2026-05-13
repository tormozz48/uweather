/**
 * PipelineProgress — animated pipeline diagram showing real-time
 * Step Functions execution progress via WebSocket events.
 *
 * Topology: Cache → [OW|WA|OM] → Compare → Landmark → [Text|Image] → Save
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import type { PipelineStageId } from '@uweather/core';
import { useRef } from 'react';
import { usePipelineConnections } from '../hooks/usePipelineConnections.js';
import type { StageStatus } from '../hooks/usePipelineProgress.js';
import {
  PIPELINE_LAYOUT,
  computeProgressPct,
  deriveRowStatus,
} from './pipeline-progress/config.js';
import { ParallelGroupRow } from './pipeline-progress/ParallelGroupRow.js';
import { PipelineConnections } from './pipeline-progress/PipelineConnections.js';
import { StageChip } from './pipeline-progress/StageChip.js';

interface Props {
  stages: Record<PipelineStageId, StageStatus>;
  connected: boolean;
}

export function PipelineProgress({ stages, connected }: Props) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef<(HTMLDivElement | null)[]>([]);

  const rowStatuses = PIPELINE_LAYOUT.map((row) => deriveRowStatus(row, stages));
  const progressPct = computeProgressPct(stages);
  const { geoms, svgDims } = usePipelineConnections(diagramRef, rowEls, PIPELINE_LAYOUT.length);

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
        gap: 1.5,
        animation: 'fadeIn 0.3s ease',
      }}
    >
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
            sx={{ fontSize: '0.7rem', fontWeight: 700, height: 22, animation: 'pipeline-pulse 2s ease-in-out infinite' }}
          />
        )}
      </Box>

      {/* Diagram: rows stacked vertically with an SVG overlay for connection lines. */}
      <Box
        ref={diagramRef}
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
          py: 0.5,
        }}
      >
        <PipelineConnections geoms={geoms} svgDims={svgDims} rowStatuses={rowStatuses} />

        {PIPELINE_LAYOUT.map((row, rowIndex) => {
          const rowKey = row.type === 'sequential' ? row.stage.id : `parallel-${row.groupLabel}`;
          return (
            <Box
              key={rowKey}
              ref={(element) => { rowEls.current[rowIndex] = element as HTMLDivElement | null; }}
              sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              {row.type === 'sequential' ? (
                <StageChip id={row.stage.id} label={row.stage.label} status={rowStatuses[rowIndex]} />
              ) : (
                <ParallelGroupRow groupLabel={row.groupLabel} stageDefs={row.stages} stages={stages} />
              )}
            </Box>
          );
        })}
      </Box>

      <LinearProgress
        variant="determinate"
        value={progressPct}
        sx={{ borderRadius: 1, height: 4, mt: 0.5 }}
      />

      <Typography variant="caption" color="text.secondary" align="center">
        Consulting 3 weather services and generating a custom image…
      </Typography>
    </Box>
  );
}

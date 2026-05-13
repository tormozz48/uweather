import AirIcon from '@mui/icons-material/Air';
import CloudIcon from '@mui/icons-material/Cloud';
import CreateIcon from '@mui/icons-material/Create';
import ImageIcon from '@mui/icons-material/Image';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { ReactNode } from 'react';
import type { StageStatus } from '../../hooks/usePipelineProgress.js';

const ICON_SX = { fontSize: '0.9rem' };

const STAGE_ICONS: Record<string, ReactNode> = {
  cache: <SearchIcon sx={ICON_SX} />,
  fetch_ow: <WbSunnyIcon sx={ICON_SX} />,
  fetch_wa: <CloudIcon sx={ICON_SX} />,
  fetch_om: <AirIcon sx={ICON_SX} />,
  compare: <PsychologyIcon sx={ICON_SX} />,
  landmark: <LocationOnIcon sx={ICON_SX} />,
  text: <CreateIcon sx={ICON_SX} />,
  image: <ImageIcon sx={ICON_SX} />,
  save: <SaveIcon sx={ICON_SX} />,
};

interface Props {
  id: string;
  label: string;
  status: StageStatus;
}

export function StageChip({ id, label, status }: Props) {
  const icon = STAGE_ICONS[id];
  const chipLabel = status === 'done' ? `${label} ✓` : label;

  return (
    <Chip
      label={chipLabel}
      icon={icon ? <Box sx={{ display: 'flex', ml: 0.75 }}>{icon}</Box> : undefined}
      size="small"
      color={status === 'done' ? 'success' : status === 'active' ? 'primary' : 'default'}
      variant={status === 'pending' ? 'outlined' : 'filled'}
      sx={{
        opacity: status === 'pending' ? 0.4 : 1,
        transition: 'all 0.4s ease',
        minWidth: 108,
        fontWeight: 600,
        fontSize: '0.72rem',
        animation: status === 'active' ? 'pipeline-pulse 1.5s ease-in-out infinite' : 'none',
        position: 'relative',
        zIndex: 1,
      }}
    />
  );
}

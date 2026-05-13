import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SkeletonCard } from './SkeletonCard.js';

export function LoadingSection() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <SkeletonCard />
      <Typography variant="caption" color="text.secondary" align="center">
        Consulting 3 weather services and generating a custom image… this takes 15–30 seconds.
      </Typography>
    </Box>
  );
}

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import MuiSkeleton from '@mui/material/Skeleton';

export function SkeletonCard() {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        <MuiSkeleton variant="text" width="55%" height={28} />
        <MuiSkeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
        <MuiSkeleton variant="text" />
        <MuiSkeleton variant="text" width="70%" />
        <MuiSkeleton variant="text" />
      </Box>
    </Paper>
  );
}

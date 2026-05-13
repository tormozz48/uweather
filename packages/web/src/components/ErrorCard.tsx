import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';

interface ErrorCardProps {
  message: string;
  onRetry: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <Alert
      severity="error"
      action={
        <Button
          color="error"
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Try again
        </Button>
      }
    >
      <AlertTitle>Something went wrong</AlertTitle>
      {message}
    </Alert>
  );
}

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface ForecastTextProps {
  funnyText: string;
}

export function ForecastText({ funnyText }: ForecastTextProps) {
  const paragraphs = funnyText.split('\n').filter((paragraph) => paragraph.trim());

  return (
    <Paper sx={{ p: 3 }}>
      {paragraphs.map((paragraph) => (
        <Typography key={paragraph} variant="body1" sx={{ lineHeight: 1.7, '& + &': { mt: 1.5 } }}>
          {paragraph}
        </Typography>
      ))}
    </Paper>
  );
}

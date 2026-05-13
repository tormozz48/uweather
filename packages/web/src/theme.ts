import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0f1117',
      paper: '#1a1d27',
    },
    primary: {
      main: '#4f8ef7',
      light: '#6ba1ff',
    },
    error: {
      main: '#f87171',
    },
    success: {
      main: '#22c55e',
    },
    text: {
      primary: '#e8eaf6',
      secondary: '#8b90a8',
    },
    divider: '#2e3348',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          // Disable MUI's subtle gradient overlay in dark mode
          backgroundImage: 'none',
          border: '1px solid #2e3348',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid #2e3348',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: '#2e3348',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

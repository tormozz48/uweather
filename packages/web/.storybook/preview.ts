import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { Decorator, Preview } from '@storybook/react';
import React from 'react';
import { theme } from '../src/theme';

/**
 * Global MUI theme decorator — wraps every story in the uweather dark
 * theme so components render identically to the production app.
 */
const withMuiTheme: Decorator = (Story) => (
  React.createElement(ThemeProvider, { theme },
    React.createElement(CssBaseline),
    React.createElement(Story)
  )
);

const preview: Preview = {
  decorators: [withMuiTheme],
  parameters: {
    backgrounds: {
      default: 'uweather-dark',
      values: [
        { name: 'uweather-dark', value: '#0f1117' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'padded',
  },
};

export default preview;

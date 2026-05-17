import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SharedForecastPage } from './SharedForecastPage.tsx';

const meta: Meta<typeof SharedForecastPage> = {
  title: 'Pages/SharedForecastPage',
  component: SharedForecastPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Public read-only page for a shared forecast link (/forecast/:forecastId). ' +
          'In Storybook the API call will fail, so the page transitions from loading to error state.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SharedForecastPage>;

/** With a forecast ID in the URL — shows loading spinner, then error (no backend). */
export const WithForecastId: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/forecast/fc-abc-123']}>
        <Routes>
          <Route path="/forecast/:forecastId" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

/** Without a forecast ID — immediately shows "No forecast ID provided" error. */
export const MissingId: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/forecast/']}>
        <Routes>
          <Route path="/forecast/" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

const meta: Meta<typeof HomePage> = {
  title: 'Pages/HomePage',
  component: HomePage,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Main page: search form, pipeline progress, forecast result, and history list. ' +
          'In Storybook the page renders in its idle state (API calls to the backend will fail gracefully).',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof HomePage>;

/** Page in its initial idle state — search form visible, no forecast loaded. */
export const Idle: Story = {};

import type { Meta, StoryObj } from '@storybook/react';
import { MOCK_FORECAST, MOCK_FORECAST_RAIN } from '../stories/mocks.ts';
import { ForecastSection } from './ForecastSection.tsx';

const meta: Meta<typeof ForecastSection> = {
  title: 'Components/ForecastSection',
  component: ForecastSection,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 600 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Full forecast result: hero image with share button, weather card, and funny text.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ForecastSection>;

export const PartlyCloudy: Story = {
  args: { forecast: MOCK_FORECAST },
};

export const Rainy: Story = {
  args: { forecast: MOCK_FORECAST_RAIN },
};

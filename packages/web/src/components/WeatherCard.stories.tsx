import type { Meta, StoryObj } from '@storybook/react';
import { MOCK_FORECAST, MOCK_FORECAST_RAIN, MOCK_FORECAST_SNOW } from '../stories/mocks';
import { WeatherCard } from './WeatherCard';

const meta: Meta<typeof WeatherCard> = {
  title: 'Components/WeatherCard',
  component: WeatherCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WeatherCard>;

export const PartlyCloudy: Story = {
  args: { forecast: MOCK_FORECAST },
};

export const Rainy: Story = {
  args: { forecast: MOCK_FORECAST_RAIN },
};

export const Snowy: Story = {
  args: { forecast: MOCK_FORECAST_SNOW },
};

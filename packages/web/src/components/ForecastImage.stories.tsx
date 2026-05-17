import type { Meta, StoryObj } from '@storybook/react';
import { MOCK_FORECAST, MOCK_FORECAST_RAIN, MOCK_FORECAST_SNOW } from '../stories/mocks.ts';
import { ForecastImage } from './ForecastImage.tsx';

const meta: Meta<typeof ForecastImage> = {
  title: 'Components/ForecastImage',
  component: ForecastImage,
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
          'Hero weather illustration with an overlay share button that copies a forecast link to the clipboard.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ForecastImage>;

export const PartlyCloudy: Story = {
  args: {
    imageUrl: MOCK_FORECAST.imageUrl,
    city: MOCK_FORECAST.city,
    forecastId: MOCK_FORECAST.forecastId,
  },
};

export const Rainy: Story = {
  args: {
    imageUrl: MOCK_FORECAST_RAIN.imageUrl,
    city: MOCK_FORECAST_RAIN.city,
    forecastId: MOCK_FORECAST_RAIN.forecastId,
  },
};

export const Snowy: Story = {
  args: {
    imageUrl: MOCK_FORECAST_SNOW.imageUrl,
    city: MOCK_FORECAST_SNOW.city,
    forecastId: MOCK_FORECAST_SNOW.forecastId,
  },
};

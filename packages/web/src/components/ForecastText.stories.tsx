import type { Meta, StoryObj } from '@storybook/react';
import { MOCK_FORECAST, MOCK_FORECAST_RAIN, MOCK_FORECAST_SNOW } from '../stories/mocks';
import { ForecastText } from './ForecastText';

const meta: Meta<typeof ForecastText> = {
  title: 'Components/ForecastText',
  component: ForecastText,
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
        component: 'Funny AI-generated weather narrative displayed as styled paragraphs in a Paper card.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ForecastText>;

export const PartlyCloudy: Story = {
  args: { funnyText: MOCK_FORECAST.funnyText },
};

export const Rainy: Story = {
  args: { funnyText: MOCK_FORECAST_RAIN.funnyText },
};

export const Snowy: Story = {
  args: { funnyText: MOCK_FORECAST_SNOW.funnyText },
};

export const SingleParagraph: Story = {
  args: { funnyText: 'Just one line of weather wisdom for you today.' },
};

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MOCK_FORECAST, MOCK_HISTORY } from '../stories/mocks.ts';
import { HistoryList } from './HistoryList.tsx';

const meta: Meta<typeof HistoryList> = {
  title: 'Components/HistoryList',
  component: HistoryList,
  tags: ['autodocs'],
  args: {
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HistoryList>;

export const MultipleForecasts: Story = {
  args: { forecasts: MOCK_HISTORY },
};

export const SingleForecast: Story = {
  args: { forecasts: [MOCK_FORECAST] },
};

export const Empty: Story = {
  args: { forecasts: [] },
};

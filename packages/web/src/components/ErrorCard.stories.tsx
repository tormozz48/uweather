import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ErrorCard } from './ErrorCard.tsx';

const meta: Meta<typeof ErrorCard> = {
  title: 'Components/ErrorCard',
  component: ErrorCard,
  tags: ['autodocs'],
  args: {
    onRetry: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ErrorCard>;

export const NetworkError: Story = {
  args: {
    message: 'Failed to fetch forecast — please check your connection and try again.',
  },
};

export const Timeout: Story = {
  args: {
    message: 'Forecast timed out — please try again.',
  },
};

export const ServerError: Story = {
  args: {
    message: 'Internal server error (500). Our weather gnomes are on break.',
  },
};

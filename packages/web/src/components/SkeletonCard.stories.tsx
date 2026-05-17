import type { Meta, StoryObj } from '@storybook/react';
import { SkeletonCard } from './SkeletonCard';

const meta: Meta<typeof SkeletonCard> = {
  title: 'Components/SkeletonCard',
  component: SkeletonCard,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Placeholder skeleton shown while a forecast card is loading.' } },
  },
};

export default meta;
type Story = StoryObj<typeof SkeletonCard>;

export const Default: Story = {};

import type { Meta, StoryObj } from '@storybook/react';
import { LoadingSection } from './LoadingSection';

const meta: Meta<typeof LoadingSection> = {
  title: 'Components/LoadingSection',
  component: LoadingSection,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Skeleton + hint text shown while the pipeline is running.' } },
  },
};

export default meta;
type Story = StoryObj<typeof LoadingSection>;

export const Default: Story = {};

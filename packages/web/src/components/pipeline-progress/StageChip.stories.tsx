import type { Meta, StoryObj } from '@storybook/react';
import { StageChip } from './StageChip';

const meta: Meta<typeof StageChip> = {
  title: 'Components/PipelineProgress/StageChip',
  component: StageChip,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'radio',
      options: ['pending', 'active', 'done'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StageChip>;

export const Pending: Story = {
  args: { id: 'cache', label: 'Cache', status: 'pending' },
};

export const Active: Story = {
  args: { id: 'compare', label: 'Compare', status: 'active' },
};

export const Done: Story = {
  args: { id: 'save', label: 'Save', status: 'done' },
};

export const FetchOpenWeather: Story = {
  args: { id: 'fetch_ow', label: 'OpenWeather', status: 'active' },
};

export const ImageDone: Story = {
  args: { id: 'image', label: 'Image', status: 'done' },
};

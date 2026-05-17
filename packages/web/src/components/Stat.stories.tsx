import type { Meta, StoryObj } from '@storybook/react';
import { Stat } from './Stat.tsx';

const meta: Meta<typeof Stat> = {
  title: 'Components/Stat',
  component: Stat,
  tags: ['autodocs'],
  argTypes: {
    icon: { control: 'text' },
    label: { control: 'text' },
    value: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Stat>;

export const Temperature: Story = {
  args: { icon: '🌡️', label: 'Temperature', value: '24°C' },
};

export const Humidity: Story = {
  args: { icon: '💧', label: 'Humidity', value: '55%' },
};

export const Wind: Story = {
  args: { icon: '💨', label: 'Wind', value: '12 km/h NW' },
};

export const UVIndex: Story = {
  args: { icon: '☀️', label: 'UV Index', value: '6' },
};

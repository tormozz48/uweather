import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { SearchForm } from './SearchForm.tsx';

const meta: Meta<typeof SearchForm> = {
  title: 'Components/SearchForm',
  component: SearchForm,
  tags: ['autodocs'],
  args: {
    onCityChange: fn(),
    onLangChange: fn(),
    onSubmit: fn((event) => event.preventDefault()),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SearchForm>;

export const Idle: Story = {
  args: { city: '', lang: 'en', isLoading: false },
};

export const WithCity: Story = {
  args: { city: 'Kyiv', lang: 'en', isLoading: false },
};

export const Loading: Story = {
  args: { city: 'London', lang: 'en', isLoading: true },
};

export const Ukrainian: Story = {
  args: { city: 'Львів', lang: 'uk', isLoading: false },
};

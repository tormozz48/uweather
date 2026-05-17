import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CityAutocomplete } from './CityAutocomplete.tsx';

const meta: Meta<typeof CityAutocomplete> = {
  title: 'Components/CityAutocomplete',
  component: CityAutocomplete,
  tags: ['autodocs'],
  args: {
    onCityChange: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'City input with geocoding autocomplete. In Storybook the hook fires against the real geocoding API, so suggestions may appear if you have network access.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CityAutocomplete>;

export const Empty: Story = {
  args: { city: '', isLoading: false },
};

export const WithValue: Story = {
  args: { city: 'Tokyo', isLoading: false },
};

export const Disabled: Story = {
  args: { city: 'Kyiv', isLoading: true },
};

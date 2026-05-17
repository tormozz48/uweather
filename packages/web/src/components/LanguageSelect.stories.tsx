import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { LanguageSelect } from './LanguageSelect';

const meta: Meta<typeof LanguageSelect> = {
  title: 'Components/LanguageSelect',
  component: LanguageSelect,
  tags: ['autodocs'],
  args: {
    onLangChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof LanguageSelect>;

export const English: Story = {
  args: { lang: 'en', isLoading: false },
};

export const Ukrainian: Story = {
  args: { lang: 'uk', isLoading: false },
};

export const Disabled: Story = {
  args: { lang: 'en', isLoading: true },
};

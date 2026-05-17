import type { Meta, StoryObj } from '@storybook/react';
import type { PipelineStageId } from '@uweather/core';
import type { StageStatus } from '../hooks/usePipelineProgress.ts';
import { PipelineProgress } from './PipelineProgress.tsx';

/** Build a full stages record with explicit overrides. */
function buildStages(
  overrides: Partial<Record<PipelineStageId, StageStatus>> = {},
): Record<PipelineStageId, StageStatus> {
  const base: Record<PipelineStageId, StageStatus> = {
    cache: 'pending',
    fetch_openweather: 'pending',
    fetch_weatherapi: 'pending',
    fetch_openmeteo: 'pending',
    compare: 'pending',
    landmark: 'pending',
    text: 'pending',
    image_cache: 'pending',
    image_gen: 'pending',
    save: 'pending',
  };
  return { ...base, ...overrides };
}

const meta: Meta<typeof PipelineProgress> = {
  title: 'Components/PipelineProgress',
  component: PipelineProgress,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Animated pipeline diagram showing Step Functions execution progress. Topology: Cache -> [OW|WA|OM] -> Compare -> Landmark -> [Text|Image] -> Save',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PipelineProgress>;

export const NotStarted: Story = {
  args: {
    stages: buildStages(),
    connected: true,
  },
};

export const FetchingWeather: Story = {
  args: {
    stages: buildStages({
      cache: 'done',
      fetch_openweather: 'active',
      fetch_weatherapi: 'active',
      fetch_openmeteo: 'active',
    }),
    connected: true,
  },
};

export const ComparingProviders: Story = {
  args: {
    stages: buildStages({
      cache: 'done',
      fetch_openweather: 'done',
      fetch_weatherapi: 'done',
      fetch_openmeteo: 'done',
      compare: 'active',
    }),
    connected: true,
  },
};

export const GeneratingContent: Story = {
  args: {
    stages: buildStages({
      cache: 'done',
      fetch_openweather: 'done',
      fetch_weatherapi: 'done',
      fetch_openmeteo: 'done',
      compare: 'done',
      landmark: 'done',
      text: 'active',
      image_cache: 'done',
      image_gen: 'active',
    }),
    connected: true,
  },
};

export const Complete: Story = {
  args: {
    stages: buildStages({
      cache: 'done',
      fetch_openweather: 'done',
      fetch_weatherapi: 'done',
      fetch_openmeteo: 'done',
      compare: 'done',
      landmark: 'done',
      text: 'done',
      image_cache: 'done',
      image_gen: 'done',
      save: 'done',
    }),
    connected: true,
  },
};

export const Disconnected: Story = {
  args: {
    stages: buildStages({
      cache: 'done',
      fetch_openweather: 'active',
      fetch_weatherapi: 'done',
      fetch_openmeteo: 'active',
    }),
    connected: false,
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import type { PipelineStageId } from '@uweather/core';
import type { StageStatus } from '../../hooks/usePipelineProgress.ts';
import { ParallelGroupRow } from './ParallelGroupRow.tsx';

/** Helper to build a full stages record with a given default status. */
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

const FETCH_STAGES = [
  { id: 'fetch_ow', label: 'OpenWeather', stageIds: ['fetch_openweather'] as PipelineStageId[] },
  { id: 'fetch_wa', label: 'WeatherAPI', stageIds: ['fetch_weatherapi'] as PipelineStageId[] },
  { id: 'fetch_om', label: 'Open-Meteo', stageIds: ['fetch_openmeteo'] as PipelineStageId[] },
];

const meta: Meta<typeof ParallelGroupRow> = {
  title: 'Components/PipelineProgress/ParallelGroupRow',
  component: ParallelGroupRow,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ParallelGroupRow>;

export const AllPending: Story = {
  args: {
    groupLabel: 'Fetch',
    stageDefs: FETCH_STAGES,
    stages: buildStages(),
  },
};

export const PartiallyActive: Story = {
  args: {
    groupLabel: 'Fetch',
    stageDefs: FETCH_STAGES,
    stages: buildStages({
      fetch_openweather: 'done',
      fetch_weatherapi: 'active',
    }),
  },
};

export const AllDone: Story = {
  args: {
    groupLabel: 'Fetch',
    stageDefs: FETCH_STAGES,
    stages: buildStages({
      fetch_openweather: 'done',
      fetch_weatherapi: 'done',
      fetch_openmeteo: 'done',
    }),
  },
};

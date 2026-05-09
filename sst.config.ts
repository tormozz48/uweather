/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'uweather',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      protect: ['prod'].includes(input?.stage ?? ''),
      home: 'aws',
    };
  },
  async run() {
    await import('./infra/storage');
    await import('./infra/api');
    // await import('./infra/pipeline');  // Phase 2
    // await import('./infra/web');       // Phase 4
    // await import('./infra/monitoring'); // Phase 5
  },
});

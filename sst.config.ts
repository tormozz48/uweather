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
    // Infra modules are imported and wired here in Phase 1+
    // await import('./infra/storage');
    // await import('./infra/api');
    // await import('./infra/pipeline');
    // await import('./infra/web');
    // await import('./infra/monitoring');
  },
});

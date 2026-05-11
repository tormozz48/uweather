/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'uweather',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      protect: ['prod'].includes(input?.stage ?? ''),
      home: 'aws',
      providers: {
        aws: {
          defaultTags: {
            tags: {
              Application: 'uweather',
              Stage: input?.stage ?? 'dev',
              ManagedBy: 'sst',
            },
          },
        },
      },
    };
  },
  async run() {
    const { applicationArn } = await import('./infra/app-registry.ts');
    await import('./infra/storage.ts'); // DynamoDB tables, S3, CloudFront (images)
    await import('./infra/pipeline.ts'); // Secrets, Lambdas, Step Functions
    await import('./infra/api.ts'); // API Gateway + route Lambdas
    await import('./infra/realtime.ts'); // WebSocket API + EventBridge rules
    await import('./infra/web.ts'); // Vite SPA StaticSite
    const { alarmSnsTopic } = await import('./infra/monitoring.ts');

    return {
      AppRegistryApplicationArn: applicationArn,
      AlarmSnsTopicArn: alarmSnsTopic.arn,
    };
  },
});

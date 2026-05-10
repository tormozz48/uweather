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
              // Resource Group ARN — used by AWS "My Applications" to discover resources.
              // The Pulumi provider only applies defaultTags to taggable resources,
              // so this is safe for all resource types (unlike a stack transform).
              awsApplication:
                'arn:aws:resource-groups:us-east-1:592147423332:group/uweather-dev/0dyi1rhftaqc6565wiwv8wdqw5',
            },
          },
        },
      },
    };
  },
  async run() {
    // app-registry MUST be first — it registers the stack transform that tags
    // all subsequent resources with awsApplication = <Resource Group ARN>
    const { applicationArn } = await import('./infra/app-registry.ts');
    await import('./infra/storage.ts'); // DynamoDB tables, S3, CloudFront (images)
    await import('./infra/pipeline.ts'); // Secrets, Lambdas, Step Functions
    await import('./infra/api.ts'); // API Gateway + route Lambdas (Phase 4)
    await import('./infra/web.ts'); // Vite SPA StaticSite (Phase 4)
    // await import('./infra/monitoring'); // Phase 5

    return {
      // Copy this ARN into defaultTags.awsApplication and redeploy
      // to make all resources appear in AWS Console → My Applications
      AppRegistryApplicationArn: applicationArn,
    };
  },
});

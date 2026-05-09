// AWS AppRegistry + Resource Group for uweather
//
// HOW "My Applications" WORKS:
//   Resources appear in the dashboard when tagged with:
//     awsApplication = <Resource Group ARN>   ← NOT the AppRegistry application ARN
//   The Resource Group ARN is shown in the console under "Application tag value".
//
// ORDERING: this file must be imported FIRST in sst.config.ts run() so the stack
// transform is registered before storage, api, and other resources are created.

const appName = `uweather-${$app.stage}`;

/**
 * AppRegistry Application — the uweather entry in "My Applications".
 */
export const application = new aws.servicecatalog.AppregistryApplication('UweatherApp', {
  name: appName,
  description: 'AI-powered weather app with Telegram bot and web UI',
  tags: {
    Application: 'uweather',
    Stage: $app.stage,
    ManagedBy: 'sst',
  },
});

export const applicationArn = application.arn;

/**
 * Tag-based Resource Group — linked to the AppRegistry application above.
 * Its ARN is what AWS uses as the `awsApplication` tag value for "My Applications".
 * Must be created before the stack transform below so its ARN is available.
 */
export const resourceGroup = new aws.resourcegroups.Group('UweatherResourceGroup', {
  name: appName,
  description: `All uweather AWS resources for stage ${$app.stage}`,
  resourceQuery: {
    type: 'TAG_FILTERS_1_0',
    query: JSON.stringify({
      ResourceTypeFilters: ['AWS::AllSupported'],
      TagFilters: [
        { Key: 'Application', Values: ['uweather'] },
        { Key: 'Stage', Values: [$app.stage] },
      ],
    }),
  },
  tags: {
    Application: 'uweather',
    Stage: $app.stage,
    ManagedBy: 'sst',
  },
});


/**
 * infra/realtime.ts — Real-time pipeline progress via WebSocket + EventBridge
 *
 * Resources:
 *   - API Gateway WebSocket API ($connect, $disconnect routes)
 *   - Lambda handlers: ws-connect, ws-disconnect, ws-push-stage
 *   - EventBridge rules:
 *       1. Custom "uweather.pipeline / StageProgress" events → ws-push-stage
 *       2. Built-in "Step Functions Execution Status Change" → ws-push-stage
 *   - IAM permissions for all the above
 *
 * Flow:
 *   1. Client opens WS with ?executionArn=... → $connect stores mapping in DynamoDB
 *   2. Pipeline Lambdas emit EventBridge events → ws-push-stage → PostToConnection
 *   3. SFN emits execution status → ws-push-stage → PostToConnection (complete)
 *   4. Client closes WS → $disconnect (TTL handles cleanup)
 */
import { connectionsTable } from './storage.ts';
import { forecastPipeline } from './pipeline.ts';

// ── Shared X-Ray config (consistent with api.ts / pipeline.ts) ──────────────

const xrayTransform: sst.aws.FunctionArgs['transform'] = {
  function: (args) => {
    args.tracingConfig = { mode: 'Active' };
  },
};

const xrayPermissions = [
  {
    actions: [
      'xray:PutTraceSegments',
      'xray:PutTelemetryRecords',
      'xray:GetSamplingRules',
      'xray:GetSamplingTargets',
    ],
    resources: ['*' as const],
  },
];

// ── WebSocket API ────────────────────────────────────────────────────────────

const wsApi = new aws.apigatewayv2.Api('PipelineWsApi', {
  name: $interpolate`uweather-pipeline-ws-${$app.stage}`,
  protocolType: 'WEBSOCKET',
  routeSelectionExpression: '$request.body.action',
});

// ── Lambda handlers ─────────────────────────────────────────────────────────

const wsConnectFn = new sst.aws.Function('WsConnectFn', {
  handler: 'packages/functions/src/ws/connect.handler',
  link: [connectionsTable],
  timeout: '10 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

const wsDisconnectFn = new sst.aws.Function('WsDisconnectFn', {
  handler: 'packages/functions/src/ws/disconnect.handler',
  timeout: '10 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

// Construct the management endpoint early — the format is predictable from
// the API ID + stage name, both of which are known before deployment.
const wsManagementEndpoint = $interpolate`https://${wsApi.id}.execute-api.${aws.getRegionOutput().name}.amazonaws.com/${$app.stage}`;

// ws-push-stage needs: (1) read connections from DynamoDB, (2) PostToConnection
const wsPushStageFn = new sst.aws.Function('WsPushStageFn', {
  handler: 'packages/functions/src/ws/push-stage.handler',
  link: [connectionsTable],
  environment: {
    WS_API_ENDPOINT: wsManagementEndpoint,
  },
  timeout: '15 seconds',
  memory: '256 MB',
  permissions: xrayPermissions,
  transform: xrayTransform,
});

// ── WebSocket routes ─────────────────────────────────────────────────────────

// $connect route
const connectIntegration = new aws.apigatewayv2.Integration('WsConnectIntegration', {
  apiId: wsApi.id,
  integrationType: 'AWS_PROXY',
  integrationUri: wsConnectFn.arn,
});

const connectRoute = new aws.apigatewayv2.Route('WsConnectRoute', {
  apiId: wsApi.id,
  routeKey: '$connect',
  target: $interpolate`integrations/${connectIntegration.id}`,
});

// $disconnect route
const disconnectIntegration = new aws.apigatewayv2.Integration('WsDisconnectIntegration', {
  apiId: wsApi.id,
  integrationType: 'AWS_PROXY',
  integrationUri: wsDisconnectFn.arn,
});

const disconnectRoute = new aws.apigatewayv2.Route('WsDisconnectRoute', {
  apiId: wsApi.id,
  routeKey: '$disconnect',
  target: $interpolate`integrations/${disconnectIntegration.id}`,
});

// ── WebSocket stage + deployment ─────────────────────────────────────────────

const wsDeployment = new aws.apigatewayv2.Deployment(
  'WsDeployment',
  { apiId: wsApi.id },
  { dependsOn: [connectRoute, disconnectRoute] },
);

const wsStage = new aws.apigatewayv2.Stage('WsStage', {
  apiId: wsApi.id,
  name: $app.stage,
  deploymentId: wsDeployment.id,
  defaultRouteSettings: {
    throttlingRateLimit: 100,
    throttlingBurstLimit: 50,
  },
});

// ── WebSocket URL exports ────────────────────────────────────────────────────

/** wss:// URL for clients to connect to. */
export const wsUrl = $interpolate`wss://${wsApi.id}.execute-api.${aws.getRegionOutput().name}.amazonaws.com/${wsStage.name}`;

// ── Lambda invoke permissions (allow API Gateway to invoke Lambda) ──────────

new aws.lambda.Permission('WsConnectPermission', {
  action: 'lambda:InvokeFunction',
  function: wsConnectFn.arn,
  principal: 'apigateway.amazonaws.com',
  sourceArn: $interpolate`${wsApi.executionArn}/*/$connect`,
});

new aws.lambda.Permission('WsDisconnectPermission', {
  action: 'lambda:InvokeFunction',
  function: wsDisconnectFn.arn,
  principal: 'apigateway.amazonaws.com',
  sourceArn: $interpolate`${wsApi.executionArn}/*/$disconnect`,
});

// ── PostToConnection permission for the push Lambda ─────────────────────────

new aws.iam.RolePolicy('WsPushManageConnectionsPolicy', {
  role: wsPushStageFn.nodes.role.id,
  policy: $jsonStringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'execute-api:ManageConnections',
        Resource: $interpolate`${wsApi.executionArn}/*`,
      },
    ],
  }),
});

// ── EventBridge rules ────────────────────────────────────────────────────────

// Rule 1: Custom stage progress events from pipeline Lambdas
const stageProgressRule = new aws.cloudwatch.EventRule('StageProgressRule', {
  name: $interpolate`uweather-stage-progress-${$app.stage}`,
  eventPattern: JSON.stringify({
    source: ['uweather.pipeline'],
    'detail-type': ['StageProgress'],
  }),
});

new aws.cloudwatch.EventTarget('StageProgressTarget', {
  rule: stageProgressRule.name,
  arn: wsPushStageFn.arn,
});

new aws.lambda.Permission('StageProgressInvokePermission', {
  action: 'lambda:InvokeFunction',
  function: wsPushStageFn.arn,
  principal: 'events.amazonaws.com',
  sourceArn: stageProgressRule.arn,
});

// Rule 2: Built-in Step Functions execution status changes (SUCCEEDED/FAILED)
const sfnStatusRule = new aws.cloudwatch.EventRule('SfnStatusRule', {
  name: $interpolate`uweather-sfn-status-${$app.stage}`,
  eventPattern: $jsonStringify({
    source: ['aws.states'],
    'detail-type': ['Step Functions Execution Status Change'],
    detail: {
      stateMachineArn: [forecastPipeline.arn],
      status: ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'],
    },
  }),
});

new aws.cloudwatch.EventTarget('SfnStatusTarget', {
  rule: sfnStatusRule.name,
  arn: wsPushStageFn.arn,
});

new aws.lambda.Permission('SfnStatusInvokePermission', {
  action: 'lambda:InvokeFunction',
  function: wsPushStageFn.arn,
  principal: 'events.amazonaws.com',
  sourceArn: sfnStatusRule.arn,
});

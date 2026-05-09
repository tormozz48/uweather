// API Gateway HTTP API + Lambda function bindings
import { weatherCacheTable, forecastsTable, usersTable, imagesBucket, imagesCdn } from './storage';

/**
 * API Gateway HTTP API.
 * All routes share CORS defaults (allowOrigins: ["*"]) for MVP.
 */
export const api = new sst.aws.ApiGatewayV2('Api', {
  cors: {
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type'],
    allowOrigins: ['*'],
  },
});

/**
 * GET /health — liveness check, returns { status, stage, timestamp }.
 */
api.route('GET /health', {
  handler: 'packages/functions/src/api/health.handler',
  link: [],
});

// Export the API URL so other stacks and the web UI can reference it
export { imagesCdn };

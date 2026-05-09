import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

export const handler: APIGatewayProxyHandlerV2 = () => {
  return Promise.resolve({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'ok',
      stage: process.env.SST_STAGE ?? 'unknown',
      timestamp: new Date().toISOString(),
    }),
  });
};

// Storage resources: DynamoDB tables, S3 bucket, CloudFront distribution

/**
 * WeatherCache — caches normalized provider responses for 30 minutes (TTL-based).
 * PK: CACHE#{city_normalized}  SK: {date}#{provider}
 */
export const weatherCacheTable = new sst.aws.Dynamo('WeatherCache', {
  fields: {
    pk: 'string',
    sk: 'string',
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  ttl: 'ttl',
});

/**
 * Forecasts — stores completed forecast results.
 * PK: FORECAST#{forecastId}  SK: META
 * GSI UserHistoryIndex: PK userId, SK createdAt
 * GSI ImageCacheIndex:  PK imageCacheKey, SK createdAt
 */
export const forecastsTable = new sst.aws.Dynamo('Forecasts', {
  fields: {
    pk: 'string',
    sk: 'string',
    userId: 'string',
    createdAt: 'string',
    imageCacheKey: 'string',
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  globalIndexes: {
    UserHistoryIndex: {
      hashKey: 'userId',
      rangeKey: 'createdAt',
      projection: 'all',
    },
    ImageCacheIndex: {
      hashKey: 'imageCacheKey',
      rangeKey: 'createdAt',
      projection: ['imageUrl', 'funnyText', 'weatherSummary'],
    },
  },
  transform: {
    table: (args) => {
      // Enable point-in-time recovery in production for disaster recovery.
      // Allows restoring the Forecasts table to any second within the last 35 days.
      if ($app.stage === 'prod') {
        args.pointInTimeRecovery = { enabled: true };
      }
    },
  },
});

/**
 * WebSocketConnections — maps Step Functions executionArn to API Gateway
 * WebSocket connectionId(s) for real-time pipeline progress updates.
 * PK: executionArn   SK: connectionId
 * TTL: 10 minutes (pipeline never takes longer than 5 min; safety margin).
 */
export const connectionsTable = new sst.aws.Dynamo('WebSocketConnections', {
  fields: {
    pk: 'string',
    sk: 'string',
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  ttl: 'ttl',
});

/**
 * Users — stores web user profiles and preferences.
 * PK: USER#{platform}#{platformId}  SK: PROFILE
 */
export const usersTable = new sst.aws.Dynamo('Users', {
  fields: {
    pk: 'string',
    sk: 'string',
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
});

/**
 * S3 bucket for generated weather images.
 * Access is restricted to CloudFront via OAC (access: "cloudfront").
 * Lifecycle: objects expire after 90 days (images become stale after a season).
 */
export const imagesBucket = new sst.aws.Bucket('UweatherImages', {
  access: 'cloudfront',
  lifecycle: [
    {
      expiresIn: '90 days',
    },
  ],
});

/**
 * CloudFront distribution in front of the images bucket.
 * All requests to /* are served from S3.
 * Images are referenced via this CDN URL in forecast records.
 */
export const imagesCdn = new sst.aws.Router('ImagesCdn', {
  routes: {
    '/*': { bucket: imagesBucket },
  },
});

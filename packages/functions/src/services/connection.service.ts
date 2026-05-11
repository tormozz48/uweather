/**
 * ConnectionService — DynamoDB CRUD for WebSocket connection tracking.
 *
 * Schema:
 *   PK: executionArn
 *   SK: connectionId
 *   ttl: epoch seconds (10 minutes from creation)
 */
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Resource } from 'sst';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TTL_SECONDS = 10 * 60; // 10 minutes

function tableName(): string {
  return Resource.WebSocketConnections.name;
}

export const connectionService = {
  /** Store a new WebSocket connection for a pipeline execution. */
  async put(executionArn: string, connectionId: string): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: { pk: executionArn, sk: connectionId, ttl },
      }),
    );
  },

  /** Remove a WebSocket connection (on disconnect). */
  async remove(executionArn: string, connectionId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: tableName(),
        Key: { pk: executionArn, sk: connectionId },
      }),
    );
  },

  /** Get all connectionIds for a given executionArn. */
  async getByExecution(executionArn: string): Promise<string[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'pk = :arn',
        ExpressionAttributeValues: { ':arn': executionArn },
        ProjectionExpression: 'sk',
      }),
    );
    return (result.Items ?? []).map((item) => item.sk as string);
  },
};

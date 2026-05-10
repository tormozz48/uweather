import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * Shared DynamoDB document client singleton.
 *
 * Import `dynamo` from here instead of constructing a new client per-file.
 * DynamoDBDocumentClient transparently marshals/unmarshals JS objects to/from
 * DynamoDB's AttributeValue format.
 */
export const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

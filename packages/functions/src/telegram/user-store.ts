/**
 * User profile persistence for the Telegram bot.
 *
 * Wraps DynamoDB reads/writes for the Users table.
 * Each Telegram user is keyed by their chat ID.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { UserProfile } from '@uweather/core';
import { createLogger } from '@uweather/core';
import { Resource } from 'sst';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const log = createLogger({ function: 'telegram-user-store' });

type UserUpdates = Partial<Pick<UserProfile, 'language' | 'city' | 'country'>>;

/**
 * Create or update a Telegram user's profile.
 * Always touches `lastActiveAt`; only updates the fields present in `updates`.
 */
export async function upsertUser(chatId: number, updates: UserUpdates): Promise<void> {
  const pk = `USER#telegram#${chatId}`;
  const sk = 'PROFILE';
  const now = new Date().toISOString();

  const existing = await dynamo.send(
    new GetCommand({ TableName: Resource.Users.name, Key: { pk, sk } }),
  );

  if (!existing.Item) {
    const profile: UserProfile = {
      pk,
      sk: 'PROFILE',
      platform: 'telegram',
      chatId: String(chatId),
      language: updates.language ?? 'en',
      city: updates.city ?? '',
      country: updates.country ?? '',
      createdAt: now,
      lastActiveAt: now,
    };
    await dynamo.send(new PutCommand({ TableName: Resource.Users.name, Item: profile }));
    log.info('User created', { chatId });
    return;
  }

  const updateParts: string[] = ['#lastActive = :now'];
  const names: Record<string, string> = { '#lastActive': 'lastActiveAt' };
  const values: Record<string, string> = { ':now': now };

  if (updates.language) {
    updateParts.push('#lang = :lang');
    names['#lang'] = 'language';
    values[':lang'] = updates.language;
  }
  if (updates.city) {
    updateParts.push('#city = :city');
    names['#city'] = 'city';
    values[':city'] = updates.city;
  }
  if (updates.country) {
    updateParts.push('#country = :country');
    names['#country'] = 'country';
    values[':country'] = updates.country;
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: Resource.Users.name,
      Key: { pk, sk },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

/** Return the stored language preference for a user, defaulting to "en". */
export async function getUserLanguage(chatId: number): Promise<string> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: Resource.Users.name,
      Key: { pk: `USER#telegram#${chatId}`, sk: 'PROFILE' },
    }),
  );
  return (result.Item as UserProfile | undefined)?.language ?? 'en';
}

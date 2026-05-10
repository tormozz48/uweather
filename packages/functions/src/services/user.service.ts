/**
 * UserService — high-level access to the Users DynamoDB table.
 *
 * Table schema:
 *   PK: USER#{platform}#{platformId}   SK: PROFILE
 */
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { UserPlatform, UserProfile } from '@uweather/core';
import { Resource } from 'sst';
import { dynamo } from './db-client.js';

type UserUpdates = Partial<Pick<UserProfile, 'language' | 'city' | 'country'>>;

export class UserService {
  private buildPk(platform: UserPlatform, platformId: string | number): string {
    return `USER#${platform}#${platformId}`;
  }

  /**
   * Fetch a user profile by platform + platform-specific ID.
   * Returns null if the user does not exist yet.
   */
  async get(platform: UserPlatform, platformId: string | number): Promise<UserProfile | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: Resource.Users.name,
        Key: { pk: this.buildPk(platform, platformId), sk: 'PROFILE' },
      }),
    );
    return (result.Item as UserProfile | undefined) ?? null;
  }

  /**
   * Write a complete user profile (create or full replace).
   */
  async save(profile: UserProfile): Promise<void> {
    await dynamo.send(new PutCommand({ TableName: Resource.Users.name, Item: profile }));
  }

  /**
   * Patch specific fields on an existing user. Always refreshes lastActiveAt.
   * Only fields present in `updates` are written — others are left untouched.
   */
  async update(
    platform: UserPlatform,
    platformId: string | number,
    updates: UserUpdates,
  ): Promise<void> {
    const now = new Date().toISOString();
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
        Key: { pk: this.buildPk(platform, platformId), sk: 'PROFILE' },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  /**
   * Create-or-update a user profile.
   * On first visit: writes a full profile with defaults.
   * On subsequent visits: patches only the provided fields and touches lastActiveAt.
   *
   * @param chatId - Platform-specific user ID (Telegram chatId, web sessionId, etc.)
   */
  async upsert(
    platform: UserPlatform,
    platformId: string | number,
    updates: UserUpdates & { chatId?: string },
  ): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.get(platform, platformId);

    if (!existing) {
      await this.save({
        pk: this.buildPk(platform, platformId),
        sk: 'PROFILE',
        platform,
        chatId: updates.chatId,
        language: updates.language ?? 'en',
        city: updates.city ?? '',
        country: updates.country ?? '',
        createdAt: now,
        lastActiveAt: now,
      });
    } else {
      await this.update(platform, platformId, updates);
    }
  }

  /**
   * Return a user's stored language preference.
   * Defaults to 'en' if the user doesn't exist or has no preference set.
   */
  async getLanguage(platform: UserPlatform, platformId: string | number): Promise<string> {
    const profile = await this.get(platform, platformId);
    return profile?.language ?? 'en';
  }
}

export const userService = new UserService();

/**
 * User profile persistence for the Telegram bot.
 *
 * Thin adapter over UserService — translates Telegram-specific chatId (number)
 * into the platform/platformId pair that the service expects.
 */
import type { UserProfile } from '@uweather/core';
import { createLogger } from '@uweather/core';
import { userService } from '../services/index.js';

const log = createLogger({ function: 'telegram-user-store' });

type UserUpdates = Partial<Pick<UserProfile, 'language' | 'city' | 'country'>>;

/**
 * Create or update a Telegram user's profile.
 * Always touches `lastActiveAt`; only updates the fields present in `updates`.
 */
export async function upsertUser(chatId: number, updates: UserUpdates): Promise<void> {
  await userService.upsert('telegram', chatId, {
    ...updates,
    chatId: String(chatId),
  });
  log.info('User upserted', { chatId });
}

/** Return the stored language preference for a user, defaulting to "en". */
export async function getUserLanguage(chatId: number): Promise<string> {
  return userService.getLanguage('telegram', chatId);
}

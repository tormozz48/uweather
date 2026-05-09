export type UserPlatform = 'telegram' | 'web';

export interface UserProfile {
  /** PK: `USER#{platform}#{platformId}` */
  pk: string;
  /** SK: `PROFILE` */
  sk: 'PROFILE';
  platform: UserPlatform;
  /** Telegram chat ID (undefined for web users) */
  chatId?: string;
  /** Preferred language (ISO 639-1), e.g. "en", "uk" */
  language: string;
  /** Last used city (normalized) */
  city?: string;
  /** Last used country code */
  country?: string;
  createdAt: string; // ISO 8601
  lastActiveAt: string; // ISO 8601
}

// @uweather/core — shared types, utilities, and prompt templates

export type {
  WeatherCondition,
  UnifiedWeatherData,
  ConsensusForecast,
  ForecastResult,
  ForecastResponse,
  UserPlatform,
  UserProfile,
  WeatherCacheEntry,
  ImageCacheEntry,
} from './types/index.js';

export {
  createLogger,
  logger,
  normalizeCity,
  getTimeSlot,
  getCurrentTimeSlot,
  toDateString,
  buildImageCacheKey,
  buildS3ImageKey,
  getTempBucket,
} from './utils/index.js';

export type {
  LogLevel,
  LogContext,
  TimeSlot,
  TempBucket,
  ImageCacheKeyParams,
} from './utils/index.js';

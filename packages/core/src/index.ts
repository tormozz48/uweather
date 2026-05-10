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
  WeatherProvider,
  ProviderInput,
  ProviderOutput,
} from './types/index.js';

export {
  createLogger,
  logger,
  emitMetric,
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
  MetricUnit,
  TimeSlot,
  TempBucket,
  ImageCacheKeyParams,
} from './utils/index.js';

export {
  transformOpenWeather,
  transformWeatherAPI,
  transformOpenMeteo,
} from './weather/index.js';

export type {
  OMGeocodingResult,
  OMGeocodingResponse,
  OMWeatherResponse,
} from './weather/index.js';

export {
  buildComparePrompt,
  buildFunnyTextPrompt,
  buildImageGenPrompt,
  buildImageGenNegativePrompt,
} from './prompts/index.js';

export type {
  ComparePromptParams,
  FunnyTextPromptParams,
  ImageGenPromptParams,
} from './prompts/index.js';

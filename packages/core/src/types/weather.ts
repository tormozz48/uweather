export type WeatherCondition =
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'fog'
  | 'windy';

export interface UnifiedWeatherData {
  provider: 'openweather' | 'weatherapi' | 'open-meteo';
  city: string;
  country: string;
  date: string; // YYYY-MM-DD
  fetchedAt: string; // ISO 8601
  temperature: number; // Celsius
  feelsLike: number; // Celsius
  humidity: number; // percentage 0-100
  windSpeed: number; // km/h
  windDirection: string; // cardinal (N, NE, E, etc.)
  condition: WeatherCondition;
  conditionDescription: string; // human-readable
  precipitation: number; // mm
  uvIndex: number; // 0-11+
  pressure: number; // hPa
  visibility: number; // km
  sunrise: string; // ISO 8601
  sunset: string; // ISO 8601
}

export interface ConsensusForecast extends Omit<UnifiedWeatherData, 'provider' | 'fetchedAt'> {
  confidence: 'high' | 'medium' | 'low'; // based on provider agreement
  providerCount: number;
  disagreements: string[]; // human-readable list of disagreements
}

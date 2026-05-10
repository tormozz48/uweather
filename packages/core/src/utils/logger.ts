export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type MetricUnit = 'Count' | 'Milliseconds' | 'Seconds' | 'Bytes' | 'Percent' | 'None';

export interface LogContext {
  service?: string;
  function?: string;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  city?: string;
  [key: string]: unknown;
}

interface LogEntry extends LogContext {
  level: LogLevel;
  timestamp: string;
  message: string;
  duration_ms?: number;
}

const SERVICE_NAME = 'uweather';

/**
 * Emit a CloudWatch metric using the Embedded Metrics Format (EMF).
 *
 * Lambda + CloudWatch Logs automatically parses EMF lines and publishes
 * them as CloudWatch custom metrics — no PutMetricData API call needed.
 *
 * Namespace: `uweather/{stage}` (from SST_STAGE env var, falls back to "dev").
 * Dimensions: `{ service: "uweather", ...dimensions }`.
 *
 * @param name    Metric name, e.g. "WeatherCacheHit"
 * @param value   Numeric value
 * @param unit    CloudWatch unit (default "Count")
 * @param dimensions  Additional dimension key/value pairs (e.g. { provider: "openweather" })
 */
export function emitMetric(
  name: string,
  value: number,
  unit: MetricUnit = 'Count',
  dimensions: Record<string, string> = {},
): void {
  const namespace = `uweather/${process.env.SST_STAGE ?? 'dev'}`;
  const allDimensions = { service: SERVICE_NAME, ...dimensions };
  const dimensionKeys = Object.keys(allDimensions);

  const entry: Record<string, unknown> = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: namespace,
          Dimensions: [dimensionKeys],
          Metrics: [{ Name: name, Unit: unit }],
        },
      ],
    },
    ...allDimensions,
    [name]: value,
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

function emit(level: LogLevel, message: string, context: LogContext): void {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    message,
    ...context,
  };
  // CloudWatch captures stdout as structured JSON when the line is valid JSON
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export function createLogger(baseContext: LogContext = {}) {
  return {
    debug(message: string, extra?: LogContext): void {
      emit('DEBUG', message, { ...baseContext, ...extra });
    },
    info(message: string, extra?: LogContext): void {
      emit('INFO', message, { ...baseContext, ...extra });
    },
    warn(message: string, extra?: LogContext): void {
      emit('WARN', message, { ...baseContext, ...extra });
    },
    error(message: string, extra?: LogContext): void {
      emit('ERROR', message, { ...baseContext, ...extra });
    },
    /**
     * Time an async operation and log its duration at INFO level on success,
     * or ERROR level on failure.
     */
    async timed<T>(label: string, fn: () => Promise<T>, extra?: LogContext): Promise<T> {
      const start = Date.now();
      try {
        const result = await fn();
        emit('INFO', label, { ...baseContext, ...extra, duration_ms: Date.now() - start });
        return result;
      } catch (err) {
        emit('ERROR', `${label} failed`, {
          ...baseContext,
          ...extra,
          duration_ms: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    /**
     * Emit a CloudWatch custom metric via EMF.
     * Convenience wrapper around the standalone `emitMetric()`.
     */
    metric(
      name: string,
      value: number,
      unit?: MetricUnit,
      dimensions?: Record<string, string>,
    ): void {
      emitMetric(name, value, unit, dimensions);
    },
    /** Return a child logger with additional context merged in */
    child(childContext: LogContext) {
      return createLogger({ ...baseContext, ...childContext });
    },
  };
}

/** Default module-level logger. Lambda handlers should use createLogger({ function: ... }) */
export const logger = createLogger();

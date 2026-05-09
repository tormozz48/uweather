export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

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
    /** Return a child logger with additional context merged in */
    child(childContext: LogContext) {
      return createLogger({ ...baseContext, ...childContext });
    },
  };
}

/** Default module-level logger. Lambda handlers should use createLogger({ function: ... }) */
export const logger = createLogger();

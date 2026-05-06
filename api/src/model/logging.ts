export interface ILogger {
  debug(message: string, object?: unknown, meta?: unknown): void
  warn(message: string, object?: unknown, meta?: unknown): void
  error(message: string, object?: unknown, meta?: unknown): void
  info(message: string, object?: unknown, meta?: unknown): void
}

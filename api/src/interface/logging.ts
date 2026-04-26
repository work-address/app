export interface ILogger {
  debug(message: string, object?: any, meta?: any): void;
  warn(message: string, object?: any, meta?: any): void;
  error(message: string, object?: any, meta?: any): void;
  info(message: string, object?: any, meta?: any): void;
}

import { inject, injectable } from 'inversify'
import { ILogger } from '@/model/logging'
import { WinstonClient } from '@/service/winston-client'

@injectable()
export class Logger implements ILogger {
  private logger: WinstonClient

  constructor(@inject('WinstonClient') winstonClient: WinstonClient) {
    this.logger = winstonClient
  }

  public error(message: string, object?: unknown): void {
    this.write('error', message, object)
  }

  public info(message: string, object?: unknown): void {
    this.write('info', message, object)
  }

  public debug(message: string, object?: unknown): void {
    this.write('debug', message, object)
  }

  public warn(message: string, object?: unknown): void {
    this.write('warn', message, object)
  }

  private write(
    level: 'error' | 'info' | 'debug' | 'warn',
    message: string,
    object?: unknown,
  ): void {
    if (object && typeof object === 'object') {
      // Single info object — metadata is part of the log event (no splat dependency)
      this.logger.client.log({
        level,
        message,
        ...(object as Record<string, unknown>),
      })
      return
    }

    this.logger.client.log(level, message)
  }
}

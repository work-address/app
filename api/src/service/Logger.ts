import {injectable} from 'inversify';
import {ILogger} from '../interface/ILogger';
import {WinstonClient} from './WinstonClient';

@injectable()
export class Logger implements ILogger {
  private logger: WinstonClient;

  constructor() {
    this.logger = new WinstonClient();
  }

  public error(message: string, object?: any): void {
    this.logger.client.error(message, object);
  }

  public info(message: string, object?: any): void {
    this.logger.client.info(message, object);
  }

  public debug(message: string, object?: any): void {
    this.logger.client.debug(message, object);
  }

  public warn(message: string, object?: any): void {
    this.logger.client.warn(message, object);
  }
}

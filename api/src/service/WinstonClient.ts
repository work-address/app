import winston from 'winston';
import fs from 'fs';

import {inject} from 'inversify';

export class WinstonClient {
  @inject('env')
  private env: string;
  public client: winston.Logger;

  constructor() {
    this.init();
  }

  private init() {
    this.client = winston.createLogger({
      level: 'debug',
    });

    if (this.env === 'test') {
      this.client.add(
        new winston.transports.Stream({
          stream: fs.createWriteStream('/dev/null'),
        })
      );
    } else if (this.env === 'development') {
      this.client.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({format: 'YYYY/MM/DD HH:mm:ss'}),
            winston.format.printf(data => {
              const {timestamp, level, message, ...metadata} = data;

              return `${timestamp as string} [${level}]: ${String(message)} ${
                metadata && Object.keys(metadata).length ? JSON.stringify(metadata) : ''
              }`;
            }),
            winston.format.colorize({all: true})
          ),
          handleExceptions: true,
        })
      );
    }
  }
}

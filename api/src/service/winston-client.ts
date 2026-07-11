import winston from 'winston'
import fs from 'fs'
import { inject, injectable } from 'inversify'

import { IConfigParameters } from '@/model/config'
import { LogglyTransport } from '@/service/loggly-transport'

@injectable()
export class WinstonClient {
  public client: winston.Logger

  constructor(
    @inject('env') env: string,
    @inject('parameters') parameters: IConfigParameters,
  ) {
    this.client = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp(),
      ),
    })

    if (env === 'test') {
      this.client.add(
        new winston.transports.Stream({
          stream: fs.createWriteStream('/dev/null'),
        }),
      )
      return
    }

    if (env === 'development') {
      this.client.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
            winston.format.printf((data) => {
              const { timestamp, level, message, ...metadata } = data

              return `${timestamp as string} [${level}]: ${String(message)} ${
                metadata && Object.keys(metadata).length
                  ? JSON.stringify(metadata)
                  : ''
              }`
            }),
            winston.format.colorize({ all: true }),
          ),
          handleExceptions: true,
        }),
      )
    } else {
      this.client.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
          handleExceptions: true,
        }),
      )
    }

    const loggly = this.parseLoggly(parameters.loggly)
    if (loggly) {
      this.client.add(
        new LogglyTransport({
          token: loggly.token,
          tags: ['address-work-api', env],
        }),
      )
      console.log(
        `Winston Loggly enabled (subdomain=${loggly.subdomain}, tags=address-work-api,${env})`,
      )
    } else if (parameters.loggly) {
      console.warn(
        'APP_LOGGLY is set but invalid; expected format: subdomain/customer-token',
      )
    } else {
      console.warn('APP_LOGGLY is empty; request logs will not go to Loggly')
    }
  }

  private parseLoggly(
    value: string,
  ): { subdomain: string; token: string } | null {
    if (!value) {
      return null
    }

    const separatorIndex = value.indexOf('/')
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      return null
    }

    const subdomain = value.slice(0, separatorIndex).trim()
    const token = value.slice(separatorIndex + 1).trim()

    if (!subdomain || !token) {
      return null
    }

    return { subdomain, token }
  }
}

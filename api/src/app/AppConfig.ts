import 'reflect-metadata';
import 'dotenv/config';

import {IConfigParameters} from '../interface/IConfigParameters';

export class AppConfig {
  public static readonly TEST_USER = `Bearer ${Buffer.from(
    String(process.env.TEST_USER_KEY)
  ).toString('base64')}`;

  public static readonly ENV = {
    test: ['test'],
    local: ['development'],
    production: ['production'],
  };

  public static getEnv(): string {
    return process.env.NODE_ENV || 'development';
  }

  public static isTest(): boolean {
    return AppConfig.ENV.test.indexOf(AppConfig.getEnv()) > -1;
  }

  public static isLocal(): boolean {
    return AppConfig.ENV.local.indexOf(AppConfig.getEnv()) > -1;
  }

  public static isProduction(): boolean {
    return AppConfig.ENV.production.indexOf(AppConfig.getEnv()) > -1;
  }

  public static readConfig(): IConfigParameters {
    return {
      host: process.env.APP_HOST as string,
      port: parseInt(process.env.APP_PORT as string),
      sentry: process.env.APP_SENTRY as string,
      redis: process.env.APP_REDIS as string,
      jwtSecret: process.env.APP_JWT_SECRET as string,
      database: {
        type: 'postgres',
        host: process.env.APP_DB_HOST as string,
        port: parseInt(process.env.APP_DB_PORT as string),
        username: process.env.APP_DB_USERNAME as string,
        password: process.env.APP_DB_PASSWORD as string,
        database: process.env.APP_DB_NAME as string,
      },
    };
  }
}
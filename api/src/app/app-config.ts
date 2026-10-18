import 'reflect-metadata'
import path from 'path'
import { config as loadEnv } from 'dotenv'

import { IConfigParameters } from '@/model/config'

const apiRoot = path.resolve(__dirname, '../..')
const isTestEnv = process.env.NODE_ENV === 'test'

loadEnv({
  path: path.join(apiRoot, isTestEnv ? '.env.test' : '.env'),
  override: isTestEnv,
})

export class AppConfig {
  public static readonly ENV = {
    test: ['test'],
    local: ['development'],
    production: ['production'],
  }

  public static getEnv(): string {
    return process.env.NODE_ENV || 'development'
  }

  public static isTest(): boolean {
    return AppConfig.ENV.test.indexOf(AppConfig.getEnv()) > -1
  }

  public static isProduction(): boolean {
    return AppConfig.ENV.production.indexOf(AppConfig.getEnv()) > -1
  }

  public static readConfig(): IConfigParameters {
    const isolated = AppConfig.isTest() && process.env.WA_TEST_DB_PORT
    return {
      host: process.env.APP_HOST as string,
      port: parseInt(process.env.APP_PORT as string),
      sentry: process.env.APP_SENTRY as string,
      redis: process.env.APP_REDIS as string,
      jwtSecret: process.env.APP_JWT_SECRET as string,
      entitlementSecret: (process.env.APP_ENTITLEMENT_SECRET ?? '').trim(),
      loggly: (process.env.APP_LOGGLY ?? '').trim(),
      tonAllowedDomains: (process.env.APP_TON_ALLOWED_DOMAINS ?? '')
        .split(',')
        .map((domain) => domain.trim())
        .filter((domain) => domain.length > 0),
      database: {
        type: 'postgres',
        host: isolated ? '127.0.0.1' : (process.env.APP_DB_HOST as string),
        port: parseInt(
          isolated
            ? process.env.WA_TEST_DB_PORT!
            : (process.env.APP_DB_PORT as string),
        ),
        username: isolated
          ? 'wa_test'
          : (process.env.APP_DB_USERNAME as string),
        password: isolated ? '' : (process.env.APP_DB_PASSWORD as string),
        database: isolated ? 'wa_test' : (process.env.APP_DB_NAME as string),
      },
    }
  }
}

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
    return {
      host: process.env.APP_HOST as string,
      port: parseInt(process.env.APP_PORT as string),
      sentry: process.env.APP_SENTRY as string,
      redis: process.env.APP_REDIS as string,
      jwtSecret: process.env.APP_JWT_SECRET as string,
      entitlementSecret: (process.env.APP_ENTITLEMENT_SECRET ?? '').trim(),
      internalSignatureAcceptLegacy: AppConfig.unlessFalse(
        process.env.APP_INTERNAL_SIGNATURE_ACCEPT_LEGACY,
      ),
      loggly: (process.env.APP_LOGGLY ?? '').trim(),
      tonAllowedDomains: (process.env.APP_TON_ALLOWED_DOMAINS ?? '')
        .split(',')
        .map((domain) => domain.trim())
        .filter((domain) => domain.length > 0),
      identity: {
        chainId: AppConfig.chainId(process.env.APP_IDENTITY_CHAIN_ID),
        registryAddress: (
          process.env.APP_IDENTITY_REGISTRY_ADDRESS ?? ''
        ).trim(),
        rpcUrl: (process.env.APP_IDENTITY_RPC_URL ?? '').trim(),
        manifestUrl: (process.env.APP_IDENTITY_MANIFEST_URL ?? '').trim(),
        deployBlock: AppConfig.blockNumber(
          process.env.APP_IDENTITY_DEPLOY_BLOCK,
        ),
      },
      identityRelayer: {
        key: (process.env.APP_IDENTITY_RELAYER_KEY ?? '').trim(),
        gasLimit: AppConfig.positiveInteger(
          process.env.APP_IDENTITY_RELAYER_GAS_LIMIT,
          250_000,
        ),
        maxFeeGwei: AppConfig.positiveNumber(
          process.env.APP_IDENTITY_RELAYER_MAX_FEE_GWEI,
          100,
        ),
        publishesPerDay: AppConfig.nonNegativeInteger(
          process.env.APP_IDENTITY_RELAYER_PUBLISHES_PER_DAY,
          5,
        ),
      },
      database: {
        type: 'postgres',
        host: process.env.APP_DB_HOST as string,
        port: parseInt(process.env.APP_DB_PORT as string),
        username: process.env.APP_DB_USERNAME as string,
        password: process.env.APP_DB_PASSWORD as string,
        database: process.env.APP_DB_NAME as string,
      },
    }
  }

  /**
   * A switch that is on unless it is set to `false` (or `0`, `off`, `no`):
   * for a compatibility window that must hold when nobody has configured
   * anything, and be closed by one explicit value.
   */
  private static unlessFalse(raw: string | undefined): boolean {
    return !['false', '0', 'off', 'no'].includes(
      (raw ?? '').trim().toLowerCase(),
    )
  }

  /** A positive decimal integer, or `fallback` for anything else. */
  private static positiveInteger(
    raw: string | undefined,
    fallback: number,
  ): number {
    const value = AppConfig.nonNegativeInteger(raw, fallback)

    return value > 0 ? value : fallback
  }

  /**
   * A decimal integer of 0 or more, or `fallback` for anything else - empty,
   * negative, a fraction, text - so a typo keeps the default rather than
   * turning a cap into NaN, which compares false with everything.
   */
  private static nonNegativeInteger(
    raw: string | undefined,
    fallback: number,
  ): number {
    const value = (raw ?? '').trim()

    if (!/^(0|[1-9]\d*)$/.test(value)) {
      return fallback
    }

    const parsed = Number(value)

    return Number.isSafeInteger(parsed) ? parsed : fallback
  }

  /** A positive decimal number (a fraction allowed), or `fallback`. */
  private static positiveNumber(
    raw: string | undefined,
    fallback: number,
  ): number {
    const value = (raw ?? '').trim()

    if (!/^\d+(\.\d+)?$/.test(value)) {
      return fallback
    }

    const parsed = Number(value)

    return parsed > 0 && Number.isFinite(parsed) ? parsed : fallback
  }

  /** A block number in decimal, or 0 (the chain's first block) for anything else. */
  private static blockNumber(raw: string | undefined): number {
    const value = (raw ?? '').trim()

    if (!/^(0|[1-9]\d*)$/.test(value)) {
      return 0
    }

    const block = Number(value)

    return Number.isSafeInteger(block) ? block : 0
  }

  /**
   * A positive decimal chain id, or null. Anything else - empty, zero, a
   * fraction, text - is null rather than NaN, so a typo disables anchoring
   * instead of reading some other chain.
   */
  private static chainId(raw: string | undefined): number | null {
    const value = (raw ?? '').trim()

    if (!/^[1-9]\d*$/.test(value)) {
      return null
    }

    const chainId = Number(value)

    return Number.isSafeInteger(chainId) ? chainId : null
  }
}

import { Container } from 'inversify'

import { IConfigParameters } from '@/model/config'

import { Http } from '@/service/http'
import { OpenApi } from '@/service/open-api'
import { Signer } from '@/service/auth/signer'
import { RedisClient } from '@/service/redis-client'
import { UserFixture } from '@/test/fixture/user-fixture'
import { UserRepository } from '@/repository/user-repository'
import { Filter } from '@/service/filter'
import { Entitlement } from '@/service/entitlement'
import { InvoiceCommitment } from '@/service/invoice-commitment'
import { InvoiceRecord } from '@/service/invoice-record'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { UserManager } from '@/service/user-manager'
import { IdentityManager } from '@/service/identity-manager'
import { IdentityChainFactory } from '@/service/identity-chain-factory'
import { IdentityReadCache } from '@/service/identity-read-cache'
import { IdentityRelayer } from '@/service/identity-relayer'
import { IdentityRelayerChainFactory } from '@/service/identity-relayer-chain-factory'
import { AdvisoryLock } from '@/service/advisory-lock'
import { Mailer } from '@/service/mailer'
import { Faker } from '@/service/faker'
import { Authenticator } from '@/service/auth/authenticator'
import { ProjectRepository } from '@/repository/project-repository'
import { ProjectStatisticsRepository } from '@/repository/project-statistics-repository'
import { ProjectManager } from '@/service/project-manager'
import { ProjectStatisticsManager } from '@/service/project-statistics-manager'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { InvoiceFixture } from '@/test/fixture/invoice-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { TimeManager } from '@/service/time-manager'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceScheduler } from '@/service/invoice-scheduler'
import { RetentionJob } from '@/service/retention-job'
import { UnitOfWork } from '@/service/unit-of-work'
import { AuthenticatorTimeTracker } from '@/service/auth/authenticator-time-tracker'
import { TonProofService } from '@/service/auth/ton-proof-service'
import { ImageResizer } from '@/service/image-resizer'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { WinstonClient } from '@/service/winston-client'
import { Logger } from '@/service/logger'
import { ILogger } from '@/model/logging'

export class AppContainer {
  private static container: Container

  public static getContainer(): Container {
    return AppContainer.container
  }

  public static build(parameters: IConfigParameters, env: string) {
    if (AppContainer.container) {
      return AppContainer.getContainer()
    }

    const container = new Container()

    container.bind<string>('env').toConstantValue(env)
    container.bind<IConfigParameters>('parameters').toConstantValue(parameters)
    container.bind<Http>('Http').to(Http)
    container.bind<OpenApi>('OpenApi').to(OpenApi)

    // Repositories
    container.bind<UserRepository>('UserRepository').to(UserRepository)
    container.bind<ProjectRepository>('ProjectRepository').to(ProjectRepository)
    container
      .bind<ProjectStatisticsRepository>('ProjectStatisticsRepository')
      .to(ProjectStatisticsRepository)
    container
    container.bind<TimeRepository>('TimeRepository').to(TimeRepository)
    container.bind<InvoiceRepository>('InvoiceRepository').to(InvoiceRepository)

    // Services
    container
      .bind<WinstonClient>('WinstonClient')
      .toDynamicValue(() => new WinstonClient(env, parameters))
      .inSingletonScope()
    container.bind<ILogger>('ILogger').to(Logger).inSingletonScope()
    container.bind<Signer>('Signer').to(Signer)
    container.bind<Authenticator>('Authenticator').to(Authenticator)
    container
      .bind<AuthenticatorTimeTracker>('AuthenticatorTimeTracker')
      .to(AuthenticatorTimeTracker)
    container.bind<RedisClient>('RedisClient').to(RedisClient)
    container.bind<Filter>('Filter').to(Filter)
    container.bind<UnitOfWork>('UnitOfWork').to(UnitOfWork)
    container.bind<Entitlement>('Entitlement').to(Entitlement)
    container
      .bind<EntitlementSignature>('EntitlementSignature')
      .to(EntitlementSignature)
    container.bind<UserManager>('UserManager').to(UserManager)
    container.bind<IdentityManager>('IdentityManager').to(IdentityManager)
    container
      .bind<IdentityChainFactory>('IdentityChainFactory')
      .to(IdentityChainFactory)
      .inSingletonScope()
    // One cache for the process, like the chain client above it: a cache per
    // request would never be read twice and would save nothing.
    container
      .bind<IdentityReadCache>('IdentityReadCache')
      .to(IdentityReadCache)
      .inSingletonScope()
    container
      .bind<IdentityRelayerChainFactory>('IdentityRelayerChainFactory')
      .to(IdentityRelayerChainFactory)
      .inSingletonScope()
    // One relayer for the process: what it has reported, and the receipts it
    // is still waiting on, live in it.
    container
      .bind<IdentityRelayer>('IdentityRelayer')
      .to(IdentityRelayer)
      .inSingletonScope()
    container.bind<AdvisoryLock>('AdvisoryLock').to(AdvisoryLock)
    container.bind<TimeManager>('TimeManager').to(TimeManager)
    container.bind<InvoiceManager>('InvoiceManager').to(InvoiceManager)
    // One scheduler for the process: it owns a timer, and a second instance
    // would arm a second one and issue everything twice over.
    container
      .bind<InvoiceScheduler>('InvoiceScheduler')
      .to(InvoiceScheduler)
      .inSingletonScope()
    // Singleton for the same reason: it owns the daily retention timer.
    container
      .bind<RetentionJob>('RetentionJob')
      .to(RetentionJob)
      .inSingletonScope()
    container.bind<Mailer>('Mailer').to(Mailer)
    container.bind<ImageResizer>('ImageResizer').to(ImageResizer)
    container.bind<ProjectManager>('ProjectManager').to(ProjectManager)
    container
    container
    container.bind<InvoiceRecord>('InvoiceRecord').to(InvoiceRecord)
    container.bind<InvoiceCommitment>('InvoiceCommitment').to(InvoiceCommitment)
    container
    container
      .bind<ProjectStatisticsManager>('ProjectStatisticsManager')
      .to(ProjectStatisticsManager)
    container.bind<TonProofService>('TonProofService').to(TonProofService)
    container.bind<Faker>('Faker').to(Faker)

    // Fixture
    container.bind<UserFixture>('UserFixture').to(UserFixture)
    container.bind<ProjectFixture>('ProjectFixture').to(ProjectFixture)
    container.bind<InvoiceFixture>('InvoiceFixture').to(InvoiceFixture)
    container.bind<TimeFixture>('TimeFixture').to(TimeFixture)

    AppContainer.container = container

    return container
  }
}

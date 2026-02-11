import {Container} from 'inversify';

import {IConfigParameters} from '../interface/IConfigParameters';

import {Http} from '../service/Http';
import {OpenApi} from '../service/OpenApi';
import {Signer} from '../service/auth/Signer';
import {RedisClient} from '../service/RedisClient';
import {UserFixture} from '../test/fixture/UserFixture';
import {UserRepository} from '../repository/UserRepository';
import {Filter} from '../service/Filter';
import {UserManager} from '../service/UserManager';
import {Mailer} from '../service/Mailer';
import {Faker} from '../service/Faker';
import {Authenticator} from '../service/auth/Authenticator';
import {ActivityRepository} from '../repository/ActivityRepository';
import {ActivityFixture} from '../test/fixture/ActivityFixture';
import {ActivityManager} from '../service/ActivityManager';
import {ProposalFixture} from '../test/fixture/ProposalFixture';
import {TimeFixture} from '../test/fixture/TimeFixture';
import {InvoiceFixture} from '../test/fixture/InvoiceFixture ';
import {ProposalRepository} from '../repository/ProposalRepository';
import {TimeRepository} from '../repository/TimeRepository';
import {InvoiceRepository} from '../repository/InvoiceRepository';
import {ProposalManager} from '../service/ProposalManager';
import {TimeManager} from '../service/TimeManager';
import {InvoiceManager} from '../service/InvoiceManager';
import {AuthenticatorTimeTracker} from '../service/auth/AuthenticatorTimeTracker';
import {TonProofService} from '../service/auth/TonProofService';
import {ImageResizer} from '../service/ImageResizer';

export class AppContainer {
  private static container: Container;

  public static getContainer(): Container {
    return AppContainer.container;
  }

  public static build(parameters: IConfigParameters, env: string) {
    if (AppContainer.container) {
      return AppContainer.getContainer();
    }

    const container = new Container({skipBaseClassChecks: true});

    container.bind<string>('env').toConstantValue(env);
    container.bind<IConfigParameters>('parameters').toConstantValue(parameters);
    container.bind<Http>('Http').to(Http);
    container.bind<OpenApi>('OpenApi').to(OpenApi);

    // Repositories
    container.bind<UserRepository>('UserRepository').to(UserRepository);
    container.bind<ActivityRepository>('ActivityRepository').to(ActivityRepository);
    container.bind<ProposalRepository>('ProposalRepository').to(ProposalRepository);
    container.bind<TimeRepository>('TimeRepository').to(TimeRepository);
    container.bind<InvoiceRepository>('InvoiceRepository').to(InvoiceRepository);

    // Services
    container.bind<Signer>('Signer').to(Signer);
    container.bind<Authenticator>('Authenticator').to(Authenticator);
    container
      .bind<AuthenticatorTimeTracker>('AuthenticatorTimeTracker')
      .to(AuthenticatorTimeTracker);
    container.bind<RedisClient>('RedisClient').to(RedisClient);
    container.bind<Filter>('Filter').to(Filter);
    container.bind<UserManager>('UserManager').to(UserManager);
    container.bind<ProposalManager>('ProposalManager').to(ProposalManager);
    container.bind<TimeManager>('TimeManager').to(TimeManager);
    container.bind<InvoiceManager>('InvoiceManager').to(InvoiceManager);
    container.bind<Mailer>('Mailer').to(Mailer);
    container.bind<ImageResizer>('ImageResizer').to(ImageResizer);
    container.bind<ActivityManager>('ActivityManager').to(ActivityManager);
    container.bind<TonProofService>('TonProofService').to(TonProofService);
    container.bind<Faker>('Faker').to(Faker);

    // Fixture
    container.bind<UserFixture>('UserFixture').to(UserFixture);
    container.bind<ActivityFixture>('ActivityFixture').to(ActivityFixture);
    container.bind<ProposalFixture>('ProposalFixture').to(ProposalFixture);
    container.bind<InvoiceFixture>('InvoiceFixture').to(InvoiceFixture);
    container.bind<TimeFixture>('TimeFixture').to(TimeFixture);

    AppContainer.container = container;

    return container;
  }
}

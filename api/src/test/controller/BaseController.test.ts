import nock from 'nock';
import {Container} from 'inversify';
import {timeout} from '@testdeck/mocha';

import {App} from '../../app/App';
import {AppConfig} from '../../app/AppConfig';
import {AppContainer} from '../../app/AppContainer';
import {createAppTest} from '../../app/AppBootstrap';
import {IConfigParameters} from '../../interface/IConfigParameters';
import {Http} from '../../service/Http';
import {Faker} from '../../service/Faker';

import {UserFixture} from '../fixture/UserFixture';
import {ActivityFixture} from '../fixture/ActivityFixture';
import {ProposalRepository} from '../../repository/ProposalRepository';
import {ProposalFixture} from '../fixture/ProposalFixture';
import {InvoiceFixture} from '../fixture/InvoiceFixture ';
import {TimeFixture} from '../fixture/TimeFixture';
import {Authenticator} from '../../service/auth/Authenticator';

export class BaseControllerTest {
  protected url: string;
  protected app: App;
  protected container: Container;
  protected parameters: IConfigParameters;
  protected http: Http;
  protected faker: Faker;
  protected authenticator: Authenticator;

  protected activityFixture: ActivityFixture;
  protected invoiceFixture: InvoiceFixture;
  protected timeFixture: TimeFixture;
  protected proposalFixture: ProposalFixture;
  protected proposalRepository: ProposalRepository;
  protected userFixture: UserFixture;

  constructor() {
    const env = AppConfig.getEnv();
    const parameters = AppConfig.readConfig();

    this.container = AppContainer.build(parameters, env);
    this.parameters = this.container.get('parameters');
    this.http = this.container.get('Http');
    this.faker = this.container.get('Faker');

    this.authenticator = this.container.get('Authenticator');

    this.userFixture = this.container.get('UserFixture');
    this.activityFixture = this.container.get('ActivityFixture');
    this.timeFixture = this.container.get('TimeFixture');
    this.proposalFixture = this.container.get('ProposalFixture');
    this.invoiceFixture = this.container.get('InvoiceFixture');

    // this.url = `http://${this.parameters.host}:${this.parameters.port}`;
    this.url = `http://app.address.work:4000`;
  }

  @timeout(10000)
  async before() {
    this.app = createAppTest();
    await this.app.boostrap();
    this.app.start();
  }

  @timeout(10000)
  async after() {
    const pendedMocks = nock.pendingMocks();

    if (pendedMocks.length > 0) {
      console.log('There are pended mocks that should be removed');
      nock.cleanAll();
    }

    await this.app.stop();
  }
}

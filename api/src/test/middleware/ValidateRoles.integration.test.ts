import {suite, test} from '@testdeck/mocha';
import * as httpMocks from 'node-mocks-http';
import {expect} from 'chai';
import {Action} from 'routing-controllers';

import {UserFixture} from '../fixture/UserFixture';
import {Authenticator} from '../../service/auth/Authenticator';
import {ValidateRoles} from '../../middleware/ValidateRoles';
import {EUserRole} from '../../interface/EUserRole';
import {AbstractDatabaseIntegration} from '../AbstractDatabase.integration';

@suite()
export class ValidateRolesTest extends AbstractDatabaseIntegration {
  protected authenticator: Authenticator;
  protected userFixture: UserFixture;

  constructor() {
    super();
    this.authenticator = this.container.get('Authenticator');
    this.userFixture = this.container.get('UserFixture');
  }

  @test()
  async user() {
    const user = await this.userFixture.createUser();
    const action: Action = {
      request: httpMocks.createRequest(),
      response: httpMocks.createResponse(),
      next: () => {},
    };

    action.request.headers['authorization'] = this.authenticator.generateJwtToken(user);

    const status = await ValidateRoles(action, [EUserRole.ROLE_USER]);

    expect(status).to.be.true;
  }
}

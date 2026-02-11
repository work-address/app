import {suite, test} from '@testdeck/mocha';
import {expect} from 'chai';

import {UserFixture} from '../fixture/UserFixture';
import {AbstractDatabaseIntegration} from '../AbstractDatabase.integration';

import {ActivityManager} from '../../service/ActivityManager';
import {ActivityFixture} from '../fixture/ActivityFixture';

@suite()
export class ActivityManagerTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture;
  protected activityFixture: ActivityFixture;
  protected activityManager: ActivityManager;

  constructor() {
    super();

    this.activityManager = this.container.get('ActivityManager');
    this.userFixture = this.container.get('UserFixture');
    this.activityFixture = this.container.get('ActivityFixture');
  }

  @test()
  async findActivityCheckAccess_personal() {
    const freelancer = await this.userFixture.createUser();
    const activity = await this.activityFixture.createPersonal(freelancer);

    const result = await this.activityManager.findActivityCheckAccess(activity, freelancer);

    expect(result?.id).to.be.equal(activity.id);
  }

  @test()
  async findActivityCheckAccess_imported() {
    const activity = await this.activityFixture.createImported();

    const result = await this.activityManager.findActivityCheckAccess(activity);

    expect(result?.id).to.be.equal(activity.id);
  }
}

import {suite, test} from '@testdeck/mocha';
import {expect} from 'chai';

import {UserFixture} from '../fixture/user-fixture';
import {AbstractDatabaseIntegration} from '../abstract-database.integration';

import {ProjectManager} from '../../service/project-manager';
import {ProjectFixture} from '../fixture/project-fixture';

@suite()
export class ProjectManagerTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture;
  protected projectFixture: ProjectFixture;
  protected projectManager: ProjectManager;

  constructor() {
    super();

    this.projectManager = this.container.get('ProjectManager');
    this.userFixture = this.container.get('UserFixture');
    this.projectFixture = this.container.get('ProjectFixture');
  }

  @test()
  async findProjectCheckAccess_personal() {
    const user = await this.userFixture.createUser();
    const project = await this.projectFixture.createPersonal(user);

    const result = await this.projectManager.findProjectCheckAccess(project, user);

    expect(result?.id).to.be.equal(project.id);
  }

}

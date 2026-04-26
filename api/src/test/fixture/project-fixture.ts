import faker from 'faker';
import {inject, injectable} from 'inversify';
import {Project} from '../../entity/project';
import {User} from '../../entity/user';

import {ProjectRepository} from '../../repository/project-repository';
import {EProjectState} from '../../interface/project';

@injectable()
export class ProjectFixture {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository;

  public create(user: User, state: EProjectState): Promise<Project> {
    const project = new Project();

    project.title = faker.datatype.uuid();
    project.text = faker.datatype.uuid();
    project.user = user;
    project.state = state;
    project.trackScreenshots = false;
    project.trackProcesses = false;

    return this.projectRepository.saveSingle(project);
  }

  public createPersonal(
    user: User,
    rateHour: number = 0,
    trackScreenshots?: boolean,
    trackProcesses?: boolean
  ): Promise<Project> {
    const project = new Project();

    project.title = faker.datatype.uuid();
    project.text = faker.datatype.uuid();
    project.user = user;
    project.rateHour = rateHour;
    project.state = EProjectState.ACTIVE;
    project.trackScreenshots = trackScreenshots;
    project.trackProcesses = trackProcesses;

    return this.projectRepository.saveSingle(project);
  }

  public createImported(): Promise<Project> {
    const project = new Project();

    project.title = faker.datatype.uuid();
    project.text = faker.datatype.uuid();
    project.rateHour = 0;
    project.state = EProjectState.ACTIVE;

    return this.projectRepository.saveSingle(project);
  }
}

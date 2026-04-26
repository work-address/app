import {inject, injectable} from 'inversify';

import {Project} from '../entity/project';
import {ProjectRepository} from '../repository/project-repository';
import {EProjectState} from '../interface/project';
import {User} from '../entity/user';
import moment from 'moment';
import {Time} from '../entity/time';
import {TimeRepository} from '../repository/time-repository';

@injectable()
export class ProjectManager {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository;
  @inject('TimeRepository')
  protected timeRepository: TimeRepository;

  public async findProjectCheckAccess(
    project: Project,
    owner: User
  ): Promise<Project | undefined> {
    return this.projectRepository.findProjectAsOwner(project, owner);
  }

  public async close(project: Project): Promise<void> {
    project.state = EProjectState.INACTIVE;

    await this.save(project);
  }

  public async editAndSave(project: Project, data: Project): Promise<void> {
    project = Object.assign(project, data);

    await this.save(project);
  }

  public save(project: Project) {
    return this.projectRepository.saveSingle(project);
  }

  public async createDemoData(user: User): Promise<void> {
    const project = new Project();
    project.title = 'Your first project';
    project.text = 'Demo';
    project.rateHour = 0;
    project.user = user;
    project.state = EProjectState.ACTIVE;

    await this.save(project);

    const times = [];
    const fromAt = moment().startOf('day');
    const toAt = moment().startOf('day').add(10, 'minutes');

    for (let i = 1; i < 6; i++) {
      const time = new Time();
      time.project = project;
      time.note = `Timesheet demo ${i}`;
      time.mouseKeys = 0;
      time.mouseDistance = 0;
      time.keyboardKeys = 0;
      time.minutesActive = i;
      time.fromAt = fromAt.toDate();
      time.toAt = toAt.toDate();

      times.push(time);

      fromAt.add(1 * 10, 'minutes');
      toAt.add(1 * 10, 'minutes');
    }

    await this.timeRepository.saveMany(times);
  }
}

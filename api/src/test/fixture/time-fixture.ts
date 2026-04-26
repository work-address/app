import faker from 'faker';
import {inject, injectable} from 'inversify';
import {Project} from '../../entity/project';

import {TimeRepository} from '../../repository/time-repository';
import {Time} from '../../entity/time';

@injectable()
export class TimeFixture {
  @inject('TimeRepository')
  protected timeRepository: TimeRepository;

  public create(project: Project, from: Date, to: Date): Promise<Time> {
    const time = new Time();

    time.project = project;
    time.note = faker.datatype.uuid();
    time.mouseKeys = faker.datatype.number(9);
    time.keyboardKeys = faker.datatype.number(9);
    time.minutesActive = faker.datatype.number(9);
    time.mouseDistance = faker.datatype.number(9);
    time.fromAt = from;
    time.toAt = to;

    return this.timeRepository.saveSingle(time);
  }
}

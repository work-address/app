import faker from 'faker';
import {inject, injectable} from 'inversify';
import {Activity} from '../../entity/Activity';

import {TimeRepository} from '../../repository/TimeRepository';
import {Time} from '../../entity/Time';

@injectable()
export class TimeFixture {
  @inject('TimeRepository')
  protected timeRepository: TimeRepository;

  public create(activity: Activity, from: Date, to: Date): Promise<Time> {
    const time = new Time();

    time.activity = activity;
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

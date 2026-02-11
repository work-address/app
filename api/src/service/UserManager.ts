import {validate} from 'class-validator';
import {inject, injectable} from 'inversify';

import {User} from '../entity/User';
import ConstraintsValidationException from '../exception/ConstraintsValidationException';
import {UserRepository} from '../repository/UserRepository';
import {Mailer} from './Mailer';

@injectable()
export class UserManager {
  @inject('UserRepository')
  protected userRepository: UserRepository;
  @inject('Mailer')
  protected mailer: Mailer;

  public async saveSingle(user: User): Promise<User> {
    return this.userRepository.saveSingle(user);
  }

  async editValidateAndSave(user: User, data: User): Promise<User> {
    user = Object.assign(user, data);

    const errors = await validate(user, {groups: ['edit']});

    if (errors.length) {
      throw new ConstraintsValidationException(errors);
    }

    return this.userRepository.saveSingle(user);
  }
}

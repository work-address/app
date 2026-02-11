import {inject, injectable} from 'inversify';

import {User} from '../entity/User';
import {ISearchUser} from '../interface/search/ISearchUser';
import {Filter} from '../service/Filter';
import {AbstractRepositoryTemplate} from './AbstractRepositoryTemplate';

@injectable()
export class UserRepository extends AbstractRepositoryTemplate<User> {
  protected target = User;
  @inject('Filter')
  protected filter: Filter;

  public updateActiveAtAndTimezone(user: User, tz: string): Promise<User> {
    user.tz = tz;

    return this.saveSingle(user);
  }

  public async findAndCount(search: ISearchUser): Promise<[User[], number]> {
    const sort = this.filter.buildOrderByCondition('user', search);
    const limit = this.filter.buildLimit(search);

    return this.getRepo()
      .createQueryBuilder('user')
      .where((qb: any) => {
        if (search.filter.id) {
          qb.andWhere('user.id = :id', {id: search.filter.id});
        }
        if (search.query) {
          qb.andWhere('user.query ILIKE :query', {query: `%${search.query}%`});
        }
      })
      .orderBy(sort)
      .skip(limit * search.page)
      .take(limit)
      .getManyAndCount();
  }

  public findByEmailPhoneOrFail(emailOrPhone: string): Promise<User> {
    return this.getRepo()
      .createQueryBuilder('u')
      .select()
      .where('u.email = :email', {email: emailOrPhone})
      .orWhere('u.phone = :phone', {phone: emailOrPhone})
      .getOneOrFail();
  }

  public findByEmailPhone(emailOrPhone: string): Promise<User | undefined> {
    return this.getRepo()
      .createQueryBuilder('u')
      .select()
      .where('lower(u.email) = :email', {email: emailOrPhone.toLocaleLowerCase()})
      .orWhere('u.phone = :phone', {phone: emailOrPhone})
      .getOne();
  }

  public findByAddressPublic(address: string): Promise<User | undefined> {
    return this.getRepo().findOne({
      where: {
        address,
      },
    });
  }

  public findByAddressPublicOrFail(address: string): Promise<User> {
    return this.getRepo().findOneOrFail({
      where: {
        address,
      },
    });
  }
}

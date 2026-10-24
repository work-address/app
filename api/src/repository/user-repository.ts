import { Effect } from 'effect'
import { inject, injectable } from 'inversify'

import { User } from '@/entity/user'
import { Filter } from '@/service/filter'
import {
  AbstractRepositoryTemplate,
  RepoEffect,
} from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'

@injectable()
export class UserRepository extends AbstractRepositoryTemplate<User> {
  protected target = User
  @inject('Filter')
  protected filter: Filter

  public updateActiveAtAndTimezone(user: User, tz: string): RepoEffect<User> {
    user.tz = tz

    return this.saveSingle(user)
  }

  public findByEmailPhoneOrFail(emailOrPhone: string): RepoEffect<User> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('u')
        .select()
        .where('u.email = :email', { email: emailOrPhone })
        .orWhere('u.phone = :phone', { phone: emailOrPhone })
        .getOneOrFail(),
    )
  }

  public findByEmailPhone(emailOrPhone: string): RepoEffect<User | undefined> {
    return fromPromise(
      async () =>
        (await this.getRepo()
          .createQueryBuilder('u')
          .select()
          .where('lower(u.email) = :email', {
            email: emailOrPhone.toLocaleLowerCase(),
          })
          .orWhere('u.phone = :phone', { phone: emailOrPhone })
          .getOne()) ?? undefined,
    )
  }

  public findByAddressPublic(address: string): RepoEffect<User | undefined> {
    return fromPromise(
      async () =>
        (await this.getRepo().findOne({
          where: {
            address,
          },
        })) ?? undefined,
    )
  }

  public findByAddressPublicOrFail(address: string): RepoEffect<User> {
    return fromPromise(() =>
      this.getRepo().findOneOrFail({
        where: {
          address,
        },
      }),
    )
  }

  public countByAddresses(addresses: string[]): RepoEffect<number> {
    if (!addresses.length) {
      return Effect.succeed(0)
    }

    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('user')
        .andWhere('lower(user.address) IN (:...addresses)', {
          addresses: addresses.map((address) => address.toLowerCase()),
        })
        .getCount(),
    )
  }

  public findByAddresses(addresses: string[]): RepoEffect<User[]> {
    if (!addresses.length) {
      return Effect.succeed([])
    }

    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('user')
        .where('lower(user.address) IN (:...addresses)', {
          addresses: addresses.map((address) => address.toLowerCase()),
        })
        .getMany(),
    )
  }
}

import { Effect } from 'effect'
import { inject, injectable } from 'inversify'

import { User } from '@/entity/user'
import { Filter } from '@/service/filter'
import {
  AbstractRepositoryTemplate,
  RepoEffect,
} from '@/repository/abstract-repository-template'
import { AccountAddress } from '@/service/account-address'
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

  public findByGoogleSub(googleSub: string): RepoEffect<User | undefined> {
    return fromPromise(
      async () =>
        (await this.getRepo().findOne({ where: { googleSub } })) ?? undefined,
    )
  }

  public findByAddressPublic(address: string): RepoEffect<User | undefined> {
    return fromPromise(
      async () => (await this.queryByAddress(address).getOne()) ?? undefined,
    )
  }

  public findByAddressPublicOrFail(address: string): RepoEffect<User> {
    return fromPromise(() => this.queryByAddress(address).getOneOrFail())
  }

  /**
   * The account an address names, however it is cased. The column's unique
   * constraint compares exact strings, so rows differing only in casing can
   * exist: the one written exactly as asked wins, so that nobody who already
   * signs in with that spelling lands in another account, and then the oldest.
   */
  private queryByAddress(address: string) {
    return this.getRepo()
      .createQueryBuilder('user')
      .where(`${AccountAddress.canonicalSql('user.address')} = :canonical`, {
        canonical: AccountAddress.toCanonical(address),
      })
      .orderBy('user.address = :address', 'DESC')
      .addOrderBy('user.createdAt', 'ASC')
      .setParameter('address', address)
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

import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { SelectQueryBuilder } from 'typeorm'

import { User } from '@/entity/user'
import { Filter } from '@/service/filter'
import {
  AbstractRepositoryTemplate,
  RepoEffect,
} from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'
import { UserSearchDto } from '@/model/dto/user'
import { WalletAddress } from '@/service/wallet-address'

@injectable()
export class UserRepository extends AbstractRepositoryTemplate<User> {
  protected target = User
  @inject('Filter')
  protected filter: Filter

  public updateActiveAtAndTimezone(user: User, tz: string): RepoEffect<User> {
    user.tz = tz

    return this.saveSingle(user)
  }

  /**
   * A page of accounts as `caller` may list them: every visible profile, and
   * the caller's own whether or not it is hidden.
   */
  public findAndCount(
    search: UserSearchDto,
    caller: User,
  ): RepoEffect<[User[], number]> {
    const sort = this.filter.buildOrderByCondition('user', search)
    const limit = this.filter.buildLimit(search)

    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('user')
        .where((qb: SelectQueryBuilder<User>) => {
          qb.andWhere('(user.visible = true OR user.id = :callerId)', {
            callerId: caller.id,
          })
          if (search.filter.id) {
            qb.andWhere('user.id = :id', { id: search.filter.id })
          }
          if (search.filter.role) {
            qb.andWhere(':role = ANY(user.roles)', { role: search.filter.role })
          }
        })
        .orderBy(sort)
        .skip(limit * search.page)
        .take(limit)
        .getManyAndCount(),
    )
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

    return fromPromise(() => this.whereAddressIsOneOf(addresses).getCount())
  }

  public findByAddresses(addresses: string[]): RepoEffect<User[]> {
    if (!addresses.length) {
      return Effect.succeed([])
    }

    return fromPromise(() => this.whereAddressIsOneOf(addresses).getMany())
  }

  /**
   * Accounts whose address `WalletAddress.isSame` counts as one of these.
   *
   * Not `lower()` on both sides: that merged two Solana accounts whose
   * base58 addresses differ only in case, so a collaborator entry resolved to
   * someone it does not name.
   */
  private whereAddressIsOneOf(addresses: string[]): SelectQueryBuilder<User> {
    const forms = [
      ...new Set(
        addresses.flatMap((address) => WalletAddress.matchForms(address)),
      ),
    ]

    return this.getRepo()
      .createQueryBuilder('user')
      .where(`${WalletAddress.canonicalSql('user.address')} = ANY(:forms)`, {
        forms,
      })
  }
}

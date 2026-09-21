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
import { IHostedIdentity } from '@/model/identity'
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

  /**
   * Applies an entitlement push unless the account already holds a newer
   * one, as a single conditional UPDATE.
   *
   * The revision test is in the WHERE clause rather than in code after a
   * read, so two pushes landing together cannot both pass it: the row lock
   * orders them, and the older one then matches nothing. An equal revision
   * is applied - that is the sweep re-asserting the same state, and it is
   * what repairs a premium flag that an ordinary save of a stale User wrote
   * back over the last push.
   */
  public applyEntitlement(
    userId: string,
    premium: boolean,
    revision: number,
    validUntil: Date | null,
  ): RepoEffect<'applied' | 'stale' | 'unknown'> {
    return fromPromise(async () => {
      // Raw SQL: both entitlement columns are `update: false`, which the
      // query builder honours by dropping them from the SET list. The table
      // name comes from entity metadata, never from request data.
      const table = this.getRepo().metadata.tableName
      const result: unknown = await this.getRepo().manager.query(
        `UPDATE "${table}"
            SET "premium" = $2,
                "entitlementRevision" = $3,
                "premiumValidUntil" = $4
          WHERE "id" = $1 AND "entitlementRevision" <= $3
          RETURNING "id"`,
        [userId, premium, revision, validUntil],
      )

      if (UserRepository.returnedRowCount(result) > 0) {
        return 'applied'
      }

      const exists = await this.getRepo().exists({ where: { id: userId } })

      return exists ? 'stale' : 'unknown'
    })
  }

  /**
   * Starts an owner's retention notice at `at`, unless one is already
   * running: the notice dates from the first run that found them free, and
   * a later run must not push it back (or forward).
   */
  public startRetentionNotice(userId: string, at: Date): RepoEffect<void> {
    return this.writeRetentionNotice(
      `"id" = $1 AND "retentionNoticeFrom" IS NULL`,
      [userId, at],
    )
  }

  /** Ends an owner's retention notice: they are premium again. */
  public clearRetentionNotice(userId: string): RepoEffect<void> {
    return this.writeRetentionNotice(`"id" = $1`, [userId, null])
  }

  /** Every account with a retention notice running. */
  public findWithRetentionNotice(): RepoEffect<User[]> {
    return fromPromise(() =>
      this.getRepo()
        // Not aliased 'user': that is a reserved word in Postgres.
        .createQueryBuilder('account')
        .where('account."retentionNoticeFrom" IS NOT NULL')
        .getMany(),
    )
  }

  /** The user's hosted presentation, or undefined when none is held. */
  public findHostedIdentity(
    user: User,
  ): RepoEffect<IHostedIdentity | undefined> {
    return fromPromise(async () => {
      const row = await this.getRepo()
        .createQueryBuilder('user')
        .select('user.id')
        .addSelect([
          'user.identityPresentation',
          'user.identityVersion',
          'user.identityExport',
        ])
        .where('user.id = :id', { id: user.id })
        .getOne()

      if (!row?.identityPresentation || !row.identityVersion) {
        return undefined
      }

      return {
        presentation: row.identityPresentation,
        version: row.identityVersion,
        export: row.identityExport ?? null,
      }
    })
  }

  /**
   * Replaces whatever was held: only the current presentation is kept.
   *
   * SQL rather than `update()`, because the columns are `update: false` so
   * that no save of a User can touch them (see User) - and TypeORM's update
   * builder honours that too.
   */
  public saveHostedIdentity(
    user: User,
    identity: IHostedIdentity,
  ): RepoEffect<void> {
    return this.writeHostedIdentity(user, [
      JSON.stringify(identity.presentation),
      identity.version,
      identity.export === null ? null : JSON.stringify(identity.export),
    ])
  }

  public removeHostedIdentity(user: User): RepoEffect<void> {
    return this.writeHostedIdentity(user, [null, null, null])
  }

  private writeHostedIdentity(
    user: User,
    [presentation, version, held]: [
      string | null,
      number | null,
      string | null,
    ],
  ): RepoEffect<void> {
    return fromPromise(async () => {
      await this.getRepo().query(
        'UPDATE "user" SET "identityPresentation" = $1, "identityVersion" = $2, "identityExport" = $3 WHERE "id" = $4',
        [presentation, version, held, user.id],
      )
    })
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

  /** `query` answers an UPDATE ... RETURNING as `[rows, count]` on pg. */
  private static returnedRowCount(result: unknown): number {
    if (!Array.isArray(result)) {
      return 0
    }

    return Array.isArray(result[0]) ? result[0].length : result.length
  }

  /**
   * Raw SQL: `retentionNoticeFrom` is `update: false`, which the query
   * builder honours by dropping it from the SET list.
   */
  private writeRetentionNotice(
    where: string,
    [userId, at]: [string, Date | null],
  ): RepoEffect<void> {
    const table = this.getRepo().metadata.tableName

    return fromPromise(async () => {
      await this.getRepo().manager.query(
        `UPDATE "${table}" SET "retentionNoticeFrom" = $2 WHERE ${where}`,
        [userId, at],
      )
    })
  }
}

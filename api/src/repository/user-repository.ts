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
import {
  ADMIN_USER_SORT_FIELDS,
  AdminDailyCountDto,
  AdminUserSearchDto,
} from '@/model/dto/admin'

const LAST_SEEN_THROTTLE = '1 hour'

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

  /** Every account, newest first unless the admin sorts otherwise. */
  public findAndCountForAdmin(
    search: AdminUserSearchDto,
    limit: number,
  ): RepoEffect<[User[], number]> {
    const filter = search.filter ?? {}
    const sortField =
      ADMIN_USER_SORT_FIELDS.find((field) => search.sort?.[field]) ??
      'createdAt'
    const direction = search.sort?.[sortField] ?? 'DESC'

    return fromPromise(() => {
      const qb = this.getRepo().createQueryBuilder('user')

      if (filter.query?.trim()) {
        const like = `%${filter.query.trim().replace(/[\\%_]/g, '\\$&')}%`
        qb.andWhere(
          '(user.name ILIKE :like OR user.email ILIKE :like OR user.phone ILIKE :like OR user.address ILIKE :like)',
          { like },
        )
      }
      if (filter.premium !== undefined) {
        qb.andWhere(
          filter.premium
            ? 'user.premium = true'
            : '(user.premium IS NULL OR user.premium = false)',
        )
      }
      if (filter.ids) {
        if (!filter.ids.length) {
          qb.andWhere('1 = 0')
        } else {
          qb.andWhere('user.id IN (:...ids)', { ids: filter.ids })
        }
      }

      return qb
        .orderBy(`user.${sortField}`, direction, 'NULLS LAST')
        .addOrderBy('user.id', 'DESC')
        .skip(limit * search.page)
        .take(limit)
        .getManyAndCount()
    })
  }

  /**
   * Records that the account was active now, unless it already was within
   * the throttle window — so a busy client costs one write an hour.
   */
  public touchLastSeen(userId: string): RepoEffect<void> {
    return fromPromise(async () => {
      await this.getRepo()
        .createQueryBuilder()
        .update(User)
        .set({ lastSeenAt: () => 'now()' })
        .where('id = :userId', { userId })
        .andWhere(
          `("lastSeenAt" IS NULL OR "lastSeenAt" < now() - interval '${LAST_SEEN_THROTTLE}')`,
        )
        .execute()
    })
  }

  public countAll(): RepoEffect<number> {
    return fromPromise(() => this.getRepo().count())
  }

  public countPremium(): RepoEffect<number> {
    return fromPromise(() => this.getRepo().count({ where: { premium: true } }))
  }

  public countSeenSince(since: Date): RepoEffect<number> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('user')
        .where('user.lastSeenAt >= :since', { since })
        .getCount(),
    )
  }

  /** New accounts per UTC day from `since` to today, zero-filled, oldest first. */
  public countSignupsByDay(since: Date): RepoEffect<AdminDailyCountDto[]> {
    return fromPromise(async () => {
      const rows: Array<{ date: string; count: string }> =
        await this.getRepo().query(
          `SELECT to_char(d.day, 'YYYY-MM-DD') AS date, count(u.id) AS count
             FROM generate_series(
                    date_trunc('day', $1::timestamptz AT TIME ZONE 'UTC'),
                    date_trunc('day', now() AT TIME ZONE 'UTC'),
                    interval '1 day'
                  ) AS d(day)
             LEFT JOIN "user" u
               ON u."deletedAt" IS NULL
              AND date_trunc('day', u."createdAt" AT TIME ZONE 'UTC') = d.day
            GROUP BY d.day
            ORDER BY d.day`,
          [since],
        )

      return rows.map((row) => ({ date: row.date, count: Number(row.count) }))
    })
  }
}

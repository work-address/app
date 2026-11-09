import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { EntityNotFoundError } from 'typeorm'

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
    return this.accountsByAddress([address]).pipe(
      Effect.map((accounts) =>
        accounts.get(AccountAddress.toCanonical(address)),
      ),
    )
  }

  public findByAddressPublicOrFail(address: string): RepoEffect<User> {
    return this.findByAddressPublic(address).pipe(
      Effect.flatMap((account) =>
        account
          ? Effect.succeed(account)
          : Effect.fail(new EntityNotFoundError(User, { address })),
      ),
    )
  }

  /**
   * The account each address names, however it is cased or padded, keyed by
   * the address's canonical form. An address nobody has signed in with is
   * absent. Signing in and every list of people read accounts through here, so
   * an address names the same account wherever it appears.
   *
   * The column's unique constraint compares exact strings, so rows differing
   * only in casing can exist: the one written exactly as asked wins, so that
   * nobody who already signs in with that spelling lands in another account,
   * and then the oldest. Asked in two spellings at once, the first decides.
   */
  public accountsByAddress(addresses: string[]): RepoEffect<Map<string, User>> {
    if (!addresses.length) {
      return Effect.succeed(new Map())
    }

    return fromPromise(async () => {
      const rows = await this.getRepo()
        .createQueryBuilder('user')
        .where(
          `${AccountAddress.canonicalSql('user.address')} IN (:...canonical)`,
          {
            canonical: [...new Set(addresses.map(AccountAddress.toCanonical))],
          },
        )
        .orderBy('user.createdAt', 'ASC')
        .addOrderBy('user.id', 'ASC')
        .getMany()

      const stored = new Map<string, User[]>()
      for (const row of rows) {
        const canonical = AccountAddress.toCanonical(row.address)
        stored.set(canonical, [...(stored.get(canonical) ?? []), row])
      }

      const named = new Map<string, User>()
      for (const address of addresses) {
        const canonical = AccountAddress.toCanonical(address)
        const candidates = stored.get(canonical)

        if (candidates && !named.has(canonical)) {
          named.set(
            canonical,
            candidates.find((row) => row.address === address) ?? candidates[0],
          )
        }
      }

      return named
    })
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
        if (filter.ids.length) {
          qb.andWhere('user.id IN (:...ids)', { ids: filter.ids })
        } else {
          qb.andWhere('1 = 0')
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

  /**
   * New accounts per UTC day from `since` to today, zero-filled, oldest first.
   * `createdAt` is really `timestamp` (CreateDateColumn wins over the
   * declared timestamptz) holding the database's local time, so it is cast
   * to timestamptz in the session zone before taking the UTC day.
   */
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
              AND date_trunc('day', u."createdAt"::timestamptz AT TIME ZONE 'UTC') = d.day
            GROUP BY d.day
            ORDER BY d.day`,
          [since],
        )

      return rows.map((row) => ({ date: row.date, count: Number(row.count) }))
    })
  }
}

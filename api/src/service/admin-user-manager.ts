import { Effect } from 'effect'
import { inject, injectable } from 'inversify'

import { User } from '@/entity/user'
import { UserRepository } from '@/repository/user-repository'
import { RepoEffect } from '@/repository/abstract-repository-template'
import {
  ADMIN_PAGE_LIMIT_MAX,
  ADMIN_STATS_DAYS_MAX,
  AdminUserDto,
  AdminUserSearchDto,
  AdminUserStatsDto,
} from '@/model/dto/admin'

const DEFAULT_PAGE_LIMIT = 20
const DEFAULT_STATS_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** Read-only account views for the admin dashboard. */
@injectable()
export class AdminUserManager {
  @inject('UserRepository')
  protected userRepository: UserRepository

  public search(
    search: AdminUserSearchDto,
  ): RepoEffect<[AdminUserDto[], number]> {
    const limit = Math.min(
      search.limit ?? DEFAULT_PAGE_LIMIT,
      ADMIN_PAGE_LIMIT_MAX,
    )

    return this.userRepository
      .findAndCountForAdmin(search, limit)
      .pipe(
        Effect.map(
          ([users, total]) =>
            [users.map(AdminUserManager.toAdminUser), total] as [
              AdminUserDto[],
              number,
            ],
        ),
      )
  }

  public stats(days?: number, now = new Date()): RepoEffect<AdminUserStatsDto> {
    const windowDays = Math.min(
      Math.max(Math.floor(days ?? DEFAULT_STATS_DAYS), 1),
      ADMIN_STATS_DAYS_MAX,
    )
    const since = (n: number) => new Date(now.getTime() - n * DAY_MS)

    return Effect.all(
      {
        total: this.userRepository.countAll(),
        premium: this.userRepository.countPremium(),
        active1d: this.userRepository.countSeenSince(since(1)),
        active7d: this.userRepository.countSeenSince(since(7)),
        active30d: this.userRepository.countSeenSince(since(30)),
        signups: this.userRepository.countSignupsByDay(since(windowDays - 1)),
      },
      { concurrency: 'unbounded' },
    ).pipe(
      Effect.map((stats) => ({
        ...stats,
        signupsInWindow: stats.signups.reduce((sum, d) => sum + d.count, 0),
      })),
    )
  }

  public static toAdminUser(user: User): AdminUserDto {
    return {
      id: user.id,
      address: user.address,
      name: user.name ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
      title: user.title ?? null,
      company: user.company ?? null,
      city: user.city ?? null,
      country: user.country ?? null,
      roles: user.roles ?? [],
      premium: user.premium === true,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt ?? null,
    }
  }
}

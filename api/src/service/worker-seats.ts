import { inject, injectable } from 'inversify'
import { IsNull } from 'typeorm'

import { getDataSource } from '@/connector/data-source'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { WorkerSeat } from '@/entity/worker-seat'
import { EProjectState } from '@/model/project'
import { FREE_PLAN_WORKERS } from '@/model/plan'
import { AccountAddress } from '@/service/account-address'
import { Entitlement } from '@/service/entitlement'

export interface ISeatWorker {
  address: string
  name: string | null
}

export interface ISeatInventory {
  /** What the bill is computed from: at least one. */
  seats: number
  /** Connected workers right now, which can be zero. */
  connected: number
  workers: ISeatWorker[]
  ownerEmail: string | null
}

export interface ISeatInterval {
  startedAt: Date
  endedAt: Date | null
}

/**
 * Who is on an owner's bill, and who may keep tracking once the owner has no
 * plan (web/PRODUCT.md §5). A seat is a listed worker who has signed in, so a
 * typo or an unused invite costs nothing, and the owner is never one.
 *
 * Closed projects don't count towards the bill, since nothing can be tracked on
 * them, but they do count towards the free limit, because reopening one takes
 * no new grant and would otherwise slip past it.
 */
@injectable()
export class WorkerSeats {
  @inject('Entitlement')
  protected entitlement: Entitlement

  /** Distinct workers on the owner's live projects, first listed first. */
  public async listed(
    ownerId: string,
    options: { activeOnly?: boolean; exceptProjectId?: string } = {},
  ): Promise<string[]> {
    const projects = await getDataSource()
      .getRepository(Project)
      .createQueryBuilder('project')
      .select(['project.id', 'project.state', 'project.workerAddresses'])
      .where('project."userId" = :ownerId', { ownerId })
      .andWhere('project."deletedAt" IS NULL')
      .orderBy('project."createdAt"', 'ASC')
      .getMany()

    const workers = new Set<string>()

    for (const project of projects) {
      if (project.id === options.exceptProjectId) continue
      if (options.activeOnly && project.state !== EProjectState.ACTIVE) continue

      for (const address of project.workerAddresses ?? []) {
        workers.add(AccountAddress.toCanonical(address))
      }
    }

    return [...workers]
  }

  /** The accounts behind these addresses. An address with none is left out. */
  public async accounts(addresses: string[]): Promise<ISeatWorker[]> {
    if (!addresses.length) return []

    const users = await getDataSource()
      .getRepository(User)
      .createQueryBuilder('u')
      .select(['u.address', 'u.name'])
      .where(`${AccountAddress.canonicalSql('u.address')} IN (:...addresses)`, {
        addresses,
      })
      .getMany()

    const found = new Map(
      users.map((user) => [AccountAddress.toCanonical(user.address), user]),
    )

    return addresses.flatMap((address) => {
      const user = found.get(address)

      return user ? [{ address: user.address, name: user.name ?? null }] : []
    })
  }

  /**
   * Brings the seat history up to what the lists say now. Callers run it before
   * and after a list changes: before, so someone who signed in since the last
   * change is on record, and after, so a removal ends their seat.
   */
  public async sync(ownerId: string, now = new Date()): Promise<void> {
    const repository = getDataSource().getRepository(WorkerSeat)
    const current = await this.accounts(
      await this.listed(ownerId, { activeOnly: true }),
    )
    const addresses = new Set(
      current.map((worker) => AccountAddress.toCanonical(worker.address)),
    )
    const open = await repository.find({
      where: { ownerId, endedAt: IsNull() },
    })

    const ended = open.filter((seat) => !addresses.has(seat.workerAddress))
    if (ended.length) {
      await repository.update(
        ended.map((seat) => seat.id),
        { endedAt: now },
      )
    }

    const opened = new Set(open.map((seat) => seat.workerAddress))
    const started = [...addresses].filter((address) => !opened.has(address))
    if (started.length) {
      await repository
        .createQueryBuilder()
        .insert()
        .values(
          started.map((workerAddress) => ({
            ownerId,
            workerAddress,
            startedAt: now,
            endedAt: null,
          })),
        )
        // Two syncs racing to open one seat: the index keeps a single row.
        .orIgnore()
        .execute()
    }
  }

  /** The most seats open at once during `[from, to)`. */
  public static peak(intervals: ISeatInterval[], from: Date, to: Date): number {
    const edges = intervals
      .filter(
        ({ startedAt, endedAt }) =>
          startedAt < to && (endedAt === null || endedAt > from),
      )
      .flatMap(({ startedAt, endedAt }) => [
        { at: Math.max(startedAt.getTime(), from.getTime()), change: 1 },
        ...(endedAt && endedAt < to
          ? [{ at: endedAt.getTime(), change: -1 }]
          : []),
      ])
      // An end sorts before a start at the same moment: replacing a worker is
      // one seat, not two.
      .sort((a, b) => a.at - b.at || a.change - b.change)

    let open = 0
    let highest = 0

    for (const { change } of edges) {
      open += change
      highest = Math.max(highest, open)
    }

    return highest
  }

  /**
   * What billing reads. With a period, the highest count during it, and never
   * fewer than are connected now, since the charge pays for the period ahead.
   */
  public async inventory(
    owner: User,
    period?: { from: Date; to: Date },
  ): Promise<ISeatInventory> {
    await this.sync(owner.id)

    const workers = await this.accounts(
      await this.listed(owner.id, { activeOnly: true }),
    )
    let count = workers.length

    if (period) {
      const intervals = await getDataSource()
        .getRepository(WorkerSeat)
        .find({ where: { ownerId: owner.id } })

      count = Math.max(
        count,
        WorkerSeats.peak(intervals, period.from, period.to),
      )
    }

    return {
      seats: Math.max(1, count),
      connected: workers.length,
      workers,
      ownerEmail:
        owner.email ??
        (AccountAddress.isEmail(owner.address) ? owner.address : null),
    }
  }

  /**
   * The workers an owner with no plan keeps tracking with: their choice, topped
   * up from the first listed until it reaches the free limit, so a lapse never
   * leaves a worker who has been kept with nothing to do but wait for a choice.
   */
  public async tracking(owner: User): Promise<Set<string>> {
    const listed = await this.listed(owner.id)

    if (listed.length <= FREE_PLAN_WORKERS) return new Set(listed)

    const chosen = (owner.keptWorkers ?? [])
      .map((address) => AccountAddress.toCanonical(address))
      .filter((address) => listed.includes(address))

    return new Set(
      [...new Set([...chosen, ...listed])].slice(0, FREE_PLAN_WORKERS),
    )
  }

  /** Whether this person's new time on the project is accepted today. */
  public async mayTrack(project: Project, user: User): Promise<boolean> {
    if (project.isOwner(user)) return true

    const address = AccountAddress.toCanonical(user.address ?? '')
    const worker = (project.workerAddresses ?? []).some((listed) =>
      AccountAddress.isSame(listed, address),
    )

    if (!worker) return false
    if (this.entitlement.isPremium(project.user)) return true

    return (await this.tracking(project.user)).has(address)
  }
}

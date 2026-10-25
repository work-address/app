import { TimeVisibility } from '@/service/time-visibility'
import { injectable } from 'inversify'
import { SelectQueryBuilder } from 'typeorm'
import { AppUsage } from '@/entity/app-usage'
import { TimeAgent } from '@/entity/time-agent'
import { Time } from '@/entity/time'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { getDataSource } from '@/connector/data-source'
import { StatisticsQueryDto } from '@/model/dto/statistics'

export interface StatisticsScope {
  projects: Project[]
  user: User
  query: StatisticsQueryDto
  from: Date
  to: Date
  owners: string[]
  viewers: string[]
}
@injectable()
export class StatisticsRepository {
  private base(scope: StatisticsScope): SelectQueryBuilder<Time> {
    const q = getDataSource()
      .getRepository(Time)
      .createQueryBuilder('time')
      .innerJoin('time.project', 'project')
      .where('project.id IN (:...projects)', {
        projects: scope.projects.map((p) => p.id),
      })
      .andWhere('project.\"deletedAt\" IS NULL')
    if (scope.query.invoiceId)
      q.andWhere('time.\"invoiceId\" = :invoice', {
        invoice: scope.query.invoiceId,
      })
    else
      q.andWhere('time.\"fromAt\" >= :from AND time.\"fromAt\" < :to', {
        from: scope.from,
        to: scope.to,
      })
    if (scope.query.userIds?.length)
      q.andWhere('time.\"userId\" IN (:...users)', {
        users: scope.query.userIds,
      })
    return q
  }
  private ownOr(scope: StatisticsScope, includeViewers: boolean): string[] {
    return [...scope.owners, ...(includeViewers ? scope.viewers : [])]
  }
  public totals(scope: StatisticsScope) {
    const q = this.base(scope)
    const shared = this.ownOr(scope, true)
    q.andWhere(
      shared.length
        ? '(project.id IN (:...shared) OR time.\"userId\" = :user)'
        : 'time.\"userId\" = :user',
      { shared, user: scope.user.id },
    )
    const seconds =
      'GREATEST(0, EXTRACT(EPOCH FROM (time.\"toAt\"-time.\"fromAt\")))'
    const active = `LEAST(${seconds}, GREATEST(0, COALESCE(time.\"minutesActive\",0)*60))`
    const detail = TimeVisibility.detailSql()
    q.setParameter('detailUser', scope.user.id)
    return q
      .select('project.id', 'projectId')
      .addSelect(`COALESCE(SUM(${seconds}),0)`, 'trackedSeconds')
      .addSelect(
        `COALESCE(SUM(CASE WHEN time.source='desktop' AND ${detail} THEN ${active} ELSE 0 END),0)`,
        'activeSeconds',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN time.source='desktop' AND ${detail} THEN ${seconds}-${active} ELSE 0 END),0)`,
        'idleSeconds',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN time.source<>'desktop' AND ${detail} THEN ${seconds} ELSE 0 END),0)`,
        'manualSeconds',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN COALESCE(time.\"isPaid\", false) THEN ${seconds} ELSE 0 END),0)`,
        'paidSeconds',
      )
      .groupBy('project.id')
      .getRawMany()
  }
  private visible(scope: StatisticsScope): SelectQueryBuilder<Time> {
    const q = this.base(scope)
    const shared = this.ownOr(scope, true)
    const published = `(time.\"publishedAt\" IS NOT NULL OR time.\"invoiceId\" IS NOT NULL OR time.\"toAt\" + COALESCE(project.\"reviewWindowHours\",24) * INTERVAL '1 hour' <= NOW())`
    q.andWhere(
      shared.length
        ? `(time.\"userId\"=:user OR (project.id IN (:...shared) AND ${published}))`
        : 'time.\"userId\"=:user',
      { shared, user: scope.user.id },
    )
    return q
  }
  public apps(scope: StatisticsScope, kind: string) {
    const q = this.visible(scope).innerJoin(
      AppUsage,
      'usage',
      'usage.\"timeId\"=time.id',
    )
    const dimensions: Record<string, string> = { app: 'usage.app' }
    if (kind === 'daily')
      dimensions.day =
        'TO_CHAR(time."fromAt" AT TIME ZONE :zone, \'YYYY-MM-DD\')'
    if (kind === 'titles') {
      dimensions.title = 'usage.title'
      dimensions.domain = 'usage.domain'
    }
    if (kind === 'workers') dimensions.userId = 'time.\"userId\"'
    if (kind === 'projects') dimensions.projectId = 'project.id'
    if (scope.query.app) q.andWhere('usage.app=:app', { app: scope.query.app })
    Object.entries(dimensions).forEach(([name, expression], index) => {
      if (index === 0) q.select(expression, name).groupBy(expression)
      else q.addSelect(expression, name).addGroupBy(expression)
    })
    return q
      .addSelect('SUM(usage.seconds)', 'seconds')
      .setParameter('zone', scope.query.timeZone)
      .orderBy('SUM(usage.seconds)', 'DESC')
      .getRawMany()
  }
  /** Tracked time per day and project, on the same terms as `totals`. */
  public timeDaily(scope: StatisticsScope) {
    const q = this.base(scope)
    const shared = this.ownOr(scope, true)
    q.andWhere(
      shared.length
        ? '(project.id IN (:...shared) OR time."userId" = :user)'
        : 'time."userId" = :user',
      { shared, user: scope.user.id },
    )
    // An hour bucket keeps the day in front, so keys sort and group alike.
    const day =
      scope.query.bucket === 'hour'
        ? 'TO_CHAR(time."fromAt" AT TIME ZONE :zone, \'YYYY-MM-DD"T"HH24\')'
        : 'TO_CHAR(time."fromAt" AT TIME ZONE :zone, \'YYYY-MM-DD\')'
    return q
      .select(day, 'day')
      .addSelect('project.id', 'projectId')
      .addSelect(
        'COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (time."toAt"-time."fromAt")))),0)',
        'trackedSeconds',
      )
      .setParameter('zone', scope.query.timeZone)
      .groupBy(day)
      .addGroupBy('project.id')
      .orderBy(day, 'ASC')
      .getRawMany()
  }

  /** The caller's own entries in the period: always theirs to see in full. */
  public ownEntries(scope: StatisticsScope) {
    return this.base({
      ...scope,
      query: { ...scope.query, userIds: [scope.user.id] },
    })
      .select('time."fromAt"', 'fromAt')
      .addSelect('time."toAt"', 'toAt')
      .addSelect(
        `CASE WHEN time.source='desktop' THEN LEAST(GREATEST(0, EXTRACT(EPOCH FROM (time."toAt"-time."fromAt"))), GREATEST(0, COALESCE(time."minutesActive",0)*60)) END`,
        'activeSeconds',
      )
      .addSelect('time."keyboardKeys"', 'keyboardKeys')
      .addSelect('time."mouseKeys"', 'mouseKeys')
      .orderBy('time."fromAt"', 'ASC')
      .getRawMany()
  }

  /**
   * Agent runs overlapping the period: every worker's on projects the caller
   * owns, their own elsewhere, never on projects they only view.
   */
  public agentRuns(scope: StatisticsScope, projectIds?: string[]) {
    const owned = scope.owners.filter(
      (id) => !projectIds || projectIds.includes(id),
    )
    const worked = scope.projects
      .map((p) => p.id)
      .filter(
        (id) =>
          !scope.owners.includes(id) &&
          !scope.viewers.includes(id) &&
          (!projectIds || projectIds.includes(id)),
      )
    if (!owned.length && !worked.length) return Promise.resolve([])
    const q = getDataSource()
      .getRepository(TimeAgent)
      .createQueryBuilder('run')
      .where('run."toAt" > :from AND run."fromAt" < :to', {
        from: scope.from,
        to: scope.to,
      })
      .andWhere(
        `(${owned.length ? 'run."projectId" IN (:...owned)' : 'FALSE'} OR (${
          worked.length ? 'run."projectId" IN (:...worked)' : 'FALSE'
        } AND run."userId" = :user))`,
        { owned, worked, user: scope.user.id },
      )
    if (scope.query.userIds?.length)
      q.andWhere('run."userId" IN (:...users)', {
        users: scope.query.userIds,
      })
    if (scope.query.invoiceId)
      q.andWhere('run."invoiceId" = :invoice', {
        invoice: scope.query.invoiceId,
      })
    return q.getMany()
  }

  /** Human entries of the given people on the given projects in the period. */
  public humanSpans(
    scope: StatisticsScope,
    userIds: string[],
    projectIds: string[],
  ) {
    if (!userIds.length || !projectIds.length) return Promise.resolve([])
    return getDataSource()
      .getRepository(Time)
      .createQueryBuilder('time')
      .select('time."userId"', 'userId')
      .addSelect('time."projectId"', 'projectId')
      .addSelect('time."fromAt"', 'fromAt')
      .addSelect('time."toAt"', 'toAt')
      .where('time."toAt" > :from AND time."fromAt" < :to', {
        from: scope.from,
        to: scope.to,
      })
      .andWhere('time."userId" IN (:...users)', { users: userIds })
      .andWhere('time."projectId" IN (:...projects)', {
        projects: projectIds,
      })
      .getRawMany()
  }

  /** Per person on the given projects: time, its visible activity and what is unpaid. */
  public team(scope: StatisticsScope, projectIds: string[]) {
    const seconds =
      'GREATEST(0, EXTRACT(EPOCH FROM (time."toAt"-time."fromAt")))'
    const active = `LEAST(${seconds}, GREATEST(0, COALESCE(time."minutesActive",0)*60))`
    const detail = TimeVisibility.detailSql()
    return this.base({
      ...scope,
      projects: scope.projects.filter((p) => projectIds.includes(p.id)),
    })
      .innerJoin('time.user', 'person')
      .select('person.id', 'userId')
      .addSelect('person.name', 'name')
      .addSelect('person.address', 'address')
      .addSelect(`COALESCE(SUM(${seconds}),0)`, 'trackedSeconds')
      .addSelect(
        `COALESCE(SUM(CASE WHEN time.source='desktop' AND ${detail} THEN ${active} ELSE 0 END),0)`,
        'activeSeconds',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN COALESCE(time."isPaid", false) THEN 0 ELSE ${seconds} END),0)`,
        'unpaidSeconds',
      )
      .setParameter('detailUser', scope.user.id)
      .groupBy('person.id')
      .getRawMany()
  }

  public gaps(scope: StatisticsScope) {
    const q = this.visible(scope)
    const active =
      'LEAST(GREATEST(0, EXTRACT(EPOCH FROM (time.\"toAt\"-time.\"fromAt\"))), GREATEST(0, COALESCE(time.\"minutesActive\",0)*60))'
    const used =
      '(SELECT COALESCE(SUM(u.seconds),0) FROM app_usage u WHERE u."timeId"=time.id)'
    return q
      .andWhere("time.source='desktop'")
      .andWhere('(time."appsStatus" IS NULL OR time."appsStatus" <> :off)', {
        off: 'off',
      })
      .select('COALESCE(time."appsStatus",\'legacy\')', 'reason')
      .addSelect(`SUM(GREATEST(0, ${active}-${used}))`, 'seconds')
      .groupBy('time.\"appsStatus\"')
      .getRawMany()
  }
}

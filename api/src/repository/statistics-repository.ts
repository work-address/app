import { TimeVisibility } from '@/service/time-visibility'
import { injectable } from 'inversify'
import { SelectQueryBuilder } from 'typeorm'
import { AppUsage } from '@/entity/app-usage'
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

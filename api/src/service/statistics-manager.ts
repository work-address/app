import { inject, injectable } from 'inversify'
import moment from 'moment-timezone'
import { BadRequestError } from 'routing-controllers'
import { ProjectRepository } from '@/repository/project-repository'
import {
  StatisticsRepository,
  StatisticsScope,
} from '@/repository/statistics-repository'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { Project } from '@/entity/project'
import { Invoice } from '@/entity/invoice'
import { User } from '@/entity/user'
import { StatisticsQueryDto } from '@/model/dto/statistics'
import { runPromise } from '@/service/effect-bridge'
import AccessException from '@/exception/access-exception'
import { StatisticsInsights } from '@/service/statistics-insights'
import { Span, TimeSpans } from '@/service/time-spans'

const APP_KINDS = ['daily', 'ranking', 'titles', 'workers', 'projects']

@injectable()
export class StatisticsManager {
  @inject('ProjectRepository') protected projects: ProjectRepository
  @inject('InvoiceRepository') protected invoices: InvoiceRepository
  @inject('StatisticsRepository') protected repository: StatisticsRepository

  public async scope(
    query: StatisticsQueryDto,
    user: User,
  ): Promise<StatisticsScope> {
    if (!moment.tz.zone(query.timeZone))
      throw new BadRequestError('Invalid timezone')
    const from = moment.tz(query.from, 'YYYY-MM-DD', true, query.timeZone)
    const to = moment.tz(query.to, 'YYYY-MM-DD', true, query.timeZone)
    if (
      !from.isValid() ||
      !to.isValid() ||
      !to.isAfter(from) ||
      to.diff(from, 'days') > 366
    )
      throw new BadRequestError(
        'Use a date range of at most 366 days; to is exclusive',
      )
    const projects = query.projectIds?.length
      ? await Promise.all(
          [...new Set(query.projectIds)].map((id) =>
            runPromise(
              this.projects.findProjectWithAccessOrFail(
                Object.assign(new Project(), { id }),
                user,
              ),
            ),
          ),
        )
      : await this.visibleProjects(query, user)
    if (
      query.userIds?.length &&
      projects.some((p) => !p.isOwner(user)) &&
      (projects.some((p) => !p.isWorker(user, true)) ||
        query.userIds.some((id) => id !== user.id))
    )
      throw new AccessException()
    if (query.invoiceId && projects.some((p) => !p.isWorker(user, true)))
      throw new AccessException()
    if (query.invoiceId) {
      const invoice = await runPromise(
        this.invoices.findOneConfirmUser(
          Object.assign(new Invoice(), { id: query.invoiceId }),
          user,
        ),
      )
      if (!projects.some((p) => p.id === invoice.project.id))
        throw new AccessException()
    }
    return {
      projects,
      query,
      user,
      from: from.toDate(),
      to: to.toDate(),
      owners: projects.filter((p) => p.isOwner(user)).map((p) => p.id),
      viewers: projects.filter((p) => !p.isWorker(user, true)).map((p) => p.id),
    }
  }
  /**
   * "All projects", narrowed to the ones the people filter can apply to, so
   * an owner who also works on someone else's project can still filter by
   * their workers instead of being refused.
   */
  private async visibleProjects(query: StatisticsQueryDto, user: User) {
    const projects = await runPromise(this.projects.findAllWithAccess(user))
    if (!query.userIds?.length) return projects
    const onlySelf = query.userIds.every((id) => id === user.id)
    return projects.filter(
      (p) => p.isOwner(user) || (onlySelf && p.isWorker(user, true)),
    )
  }

  public async read(kind: string, query: StatisticsQueryDto, user: User) {
    const scope = await this.scope(query, user)
    if (!scope.projects.length) {
      if (!['overview', 'summary', ...APP_KINDS].includes(kind))
        throw new BadRequestError('Unknown statistics report')
      return kind === 'overview' || kind === 'summary'
        ? { totals: [], apps: [], gaps: [] }
        : { rows: [] }
    }
    if (kind === 'workers' && scope.owners.length !== scope.projects.length)
      throw new AccessException()
    if (kind === 'titles' && scope.viewers.length) throw new AccessException()
    if (kind === 'overview' || kind === 'summary') {
      const [totals, apps, gaps] = await Promise.all([
        this.repository.totals(scope),
        this.repository.apps(scope, 'projects'),
        this.repository.gaps(scope),
      ])
      for (const row of totals) {
        if (scope.viewers.includes(row.projectId)) {
          delete row.activeSeconds
          delete row.idleSeconds
          delete row.manualSeconds
          delete row.paidSeconds
        }
      }
      return { totals, apps, gaps: scope.viewers.length ? [] : gaps }
    }
    if (!APP_KINDS.includes(kind))
      throw new BadRequestError('Unknown statistics report')
    return { rows: await this.repository.apps(scope, kind) }
  }

  /** Tracked time per day and project. */
  public async timeDaily(query: StatisticsQueryDto, user: User) {
    const scope = await this.scope(query, user)
    if (!scope.projects.length) return { rows: [] }
    const rows = await this.repository.timeDaily(scope)
    return {
      rows: rows.map((row) => ({
        day: row.day,
        projectId: row.projectId,
        trackedSeconds: Math.round(Number(row.trackedSeconds)),
      })),
    }
  }

  /**
   * The caller's own entries. Insights describe the person reading them,
   * whoever the people filter selects - an owner never gets another
   * person's focus or intensity from here.
   */
  private async ownEntries(query: StatisticsQueryDto, user: User) {
    const scope = await this.scope({ ...query, userIds: undefined }, user)
    if (!scope.projects.length) return []
    const rows = await this.repository.ownEntries(scope)
    const apps = new Map<string, { name: string; seconds: number }[]>()
    for (const usage of await this.repository.appsOf(rows.map((r) => r.id)))
      apps.set(usage.timeId, [
        ...(apps.get(usage.timeId) ?? []),
        { name: usage.app, seconds: Number(usage.seconds) },
      ])
    const number = (value: unknown) => (value == null ? null : Number(value))
    return rows.map((row) => ({
      projectId: row.projectId as string,
      apps: apps.get(row.id) ?? [],
      fromAt: new Date(row.fromAt),
      toAt: new Date(row.toAt),
      activeSeconds: number(row.activeSeconds),
      keyboardKeys: number(row.keyboardKeys),
      mouseKeys: number(row.mouseKeys),
    }))
  }

  /** The caller's active time by weekday and hour. */
  public async timeHourly(query: StatisticsQueryDto, user: User) {
    const entries = await this.ownEntries(query, user)
    return { rows: StatisticsInsights.hourly(entries, query.timeZone) }
  }

  public async insightsMe(query: StatisticsQueryDto, user: User) {
    const entries = await this.ownEntries(query, user)
    return StatisticsInsights.me(entries, query.timeZone)
  }

  public async agentsDaily(query: StatisticsQueryDto, user: User) {
    const scope = await this.scope(query, user)
    if (!scope.projects.length) return { daily: [], runs: [] }
    const runs = await this.repository.agentRuns(scope)
    const human = await this.repository.humanSpans(
      scope,
      [...new Set(runs.map((run) => run.userId))],
      [...new Set(runs.map((run) => run.projectId))],
    )
    const daily = StatisticsInsights.agentDaily(
      runs,
      human.map((row) => ({
        userId: row.userId,
        projectId: row.projectId,
        span: [+new Date(row.fromAt), +new Date(row.toAt)] as Span,
      })),
      [+scope.from, +scope.to],
      query.timeZone,
      query.bucket ?? 'day',
    )
    const counts = new Map<
      string,
      { product: string; status: string; count: number }
    >()
    for (const run of runs) {
      const key = `${run.product}:${run.status}`
      const row = counts.get(key) ?? {
        product: run.product,
        status: run.status,
        count: 0,
      }
      row.count++
      counts.set(key, row)
    }
    return {
      daily,
      runs: [...counts.values()].sort(
        (a, b) =>
          a.product.localeCompare(b.product) ||
          a.status.localeCompare(b.status),
      ),
    }
  }

  /**
   * Each person's time on the caller's own projects, sorted by name. Never
   * ranked: the order says nothing about anyone.
   */
  public async team(query: StatisticsQueryDto, user: User) {
    const scope = await this.scope(query, user)
    if (!scope.owners.length) throw new AccessException()
    const [rows, runs] = await Promise.all([
      this.repository.team(scope, scope.owners),
      this.repository.agentRuns(scope, scope.owners),
    ])
    const agentMs = new Map<string, number>()
    const byAgent = new Map<string, Span[]>()
    for (const run of runs) {
      const key = `${run.userId}:${run.agentId}`
      byAgent.set(key, [
        ...(byAgent.get(key) ?? []),
        ...run.segments
          .filter((segment) => segment.state === 'running')
          .map((s): Span => [Date.parse(s.fromAt), Date.parse(s.toAt)]),
      ])
    }
    for (const [key, spans] of byAgent) {
      const userId = key.split(':')[0]
      const ms = TimeSpans.ms(
        TimeSpans.intersect(TimeSpans.union(spans), [[+scope.from, +scope.to]]),
      )
      agentMs.set(userId, (agentMs.get(userId) ?? 0) + ms)
    }
    const people = rows.map((row) => ({
      userId: row.userId as string,
      name: (row.name || row.address) as string,
      trackedSeconds: Math.round(Number(row.trackedSeconds)),
      activeSeconds: Math.round(Number(row.activeSeconds)),
      unpaidSeconds: Math.round(Number(row.unpaidSeconds)),
      agentSeconds: Math.round((agentMs.get(row.userId) ?? 0) / 1000),
    }))
    // Someone whose agents worked while they tracked nothing still appears.
    for (const [userId, ms] of agentMs)
      if (!people.some((p) => p.userId === userId))
        people.push({
          userId,
          name: userId,
          trackedSeconds: 0,
          activeSeconds: 0,
          unpaidSeconds: 0,
          agentSeconds: Math.round(ms / 1000),
        })
    return {
      rows: people.sort((a, b) => a.name.localeCompare(b.name)),
    }
  }
}

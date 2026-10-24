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
}

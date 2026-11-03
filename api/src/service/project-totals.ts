import { inject, injectable } from 'inversify'

import { getDataSource } from '@/connector/data-source'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { EInvoiceState } from '@/model/invoice'
import { ITimeTotals } from '@/model/time'
import { ProjectAccess, ProjectRole } from '@/service/project-access'

/**
 * What a read covers. No dates is all time; dates are half-open and an entry
 * belongs to the span its `fromAt` falls in; `invoiceId` replaces the dates.
 */
export interface IProjectTotalsSpan {
  from?: Date
  to?: Date
  userIds?: string[]
  invoiceId?: string
}

/** A figure the reader may not see is absent: never null, never zero. */
export interface IProjectFigures {
  projectId: string
  trackedSeconds: number
  activeSeconds?: number
  idleSeconds?: number
  manualSeconds?: number
  keyboardKeys?: number
  mouseKeys?: number
  mouseDistance?: number
  paidSeconds?: number
  unpaidSeconds?: number
  rateHour?: number
  earnedCents?: number
  paidCents?: number
  unpaidCents?: number
}

type EntrySums = Record<
  | 'tracked'
  | 'active'
  | 'idle'
  | 'manual'
  | 'keyboard'
  | 'mouse'
  | 'distance'
  | 'paid'
  | 'handPaid',
  number
>

const NOTHING: EntrySums = {
  tracked: 0,
  active: 0,
  idle: 0,
  manual: 0,
  keyboard: 0,
  mouse: 0,
  distance: 0,
  paid: 0,
  handPaid: 0,
}

/** An entry's span: a backwards entry counts as nothing. */
const SECONDS = 'GREATEST(0, EXTRACT(EPOCH FROM (time."toAt"-time."fromAt")))'
const ACTIVE = `LEAST(${SECONDS}, GREATEST(0, COALESCE(time."minutesActive",0)*60))`

/**
 * Which figures a reader may see for a project over a span (SPEC.md, "Who can
 * see what"): a viewer the project's time and nothing else, a worker their own
 * time and what it earned, an owner everyone's. Every route that answers with
 * project totals reads them here, so a figure cannot reach a reader by one
 * route and not by another.
 */
@injectable()
export class ProjectTotals {
  @inject('ProjectAccess') protected access: ProjectAccess

  public async read(
    projects: Project[],
    reader: User,
    span: IProjectTotalsSpan = {},
  ): Promise<IProjectFigures[]> {
    const onProject = projects
      .map((project) => ({
        project,
        role: this.access.role(project, reader),
      }))
      .filter((row): row is { project: Project; role: ProjectRole } =>
        Boolean(row.role),
      )

    if (!onProject.length) return []

    const [entries, settled] = await Promise.all([
      this.entrySums(onProject, reader, span),
      this.settledCents(onProject, reader, span),
    ])

    return onProject
      .filter(
        ({ project }) => entries.has(project.id) || settled.has(project.id),
      )
      .map(({ project, role }) =>
        role === 'viewer'
          ? {
              projectId: project.id,
              trackedSeconds: Math.round(entries.get(project.id)?.tracked ?? 0),
            }
          : this.figures(
              project,
              entries.get(project.id) ?? NOTHING,
              settled.get(project.id) ?? 0,
            ),
      )
      .sort((a, b) => a.projectId.localeCompare(b.projectId))
  }

  /** All time, in the minutes `/time/totals` has always answered in. */
  public async readAllTime(
    project: Project,
    reader: User,
  ): Promise<ITimeTotals[]> {
    const minutes = (seconds?: number) =>
      seconds === undefined ? undefined : Math.round(seconds / 60)

    return (await this.read([project], reader)).map((row) => ({
      projectId: row.projectId,
      minutes: Math.round(row.trackedSeconds / 60),
      rateHour: row.rateHour,
      minutesActive: minutes(row.activeSeconds),
      minutesPaid: minutes(row.paidSeconds),
      minutesUnpaid: minutes(row.unpaidSeconds),
      keyboardKeys: row.keyboardKeys,
      mouseKeys: row.mouseKeys,
      mouseDistance: row.mouseDistance,
      earnedCents: row.earnedCents,
      paidCents: row.paidCents,
      unpaidCents: row.unpaidCents,
    }))
  }

  private figures(
    project: Project,
    sums: EntrySums,
    settledCents: number,
  ): IProjectFigures {
    const rateHour = Number(project.rateHour || 0)
    const rateHourCents = Math.round(rateHour * 100)
    // Rounded once, at the end, like an invoice's own lines.
    const priced = (seconds: number) =>
      Math.round((seconds * rateHourCents) / 3600)
    const unpaid = Math.max(0, sums.tracked - sums.paid)

    return {
      projectId: project.id,
      trackedSeconds: Math.round(sums.tracked),
      activeSeconds: Math.round(sums.active),
      idleSeconds: Math.round(sums.idle),
      manualSeconds: Math.round(sums.manual),
      keyboardKeys: sums.keyboard,
      mouseKeys: sums.mouse,
      mouseDistance: sums.distance,
      paidSeconds: Math.round(sums.paid),
      unpaidSeconds: Math.round(unpaid),
      rateHour,
      earnedCents: priced(sums.tracked),
      // A paid invoice counts through its amount, whatever its entries say
      // now; hand-marked time counts at today's rate, an estimate until billed.
      paidCents: settledCents + priced(sums.handPaid),
      unpaidCents: priced(unpaid),
    }
  }

  /** A worker counts their own entries; an owner and a viewer the project's. */
  private async entrySums(
    onProject: { project: Project; role: ProjectRole }[],
    reader: User,
    span: IProjectTotalsSpan,
  ): Promise<Map<string, EntrySums>> {
    const shared = onProject
      .filter(({ role }) => role !== 'worker')
      .map(({ project }) => project.id)
    const detail = this.access.detailSql()
    const when = (condition: string, value: string) =>
      `COALESCE(SUM(CASE WHEN ${condition} THEN ${value} ELSE 0 END),0)`
    const onSettled = `settled.id = time."invoiceId" AND settled.state = :paidState`
    const qb = getDataSource()
      .getRepository(Time)
      .createQueryBuilder('time')
      .innerJoin('time.project', 'project')
      .leftJoin(Invoice, 'settled', onSettled, {
        paidState: EInvoiceState.PAID,
      })
      .where('project.id IN (:...projects)', {
        projects: onProject.map(({ project }) => project.id),
      })
      .andWhere('project."deletedAt" IS NULL')
      .andWhere(
        shared.length
          ? '(project.id IN (:...shared) OR time."userId" = :reader)'
          : 'time."userId" = :reader',
        { shared, reader: reader.id },
      )
      .setParameter('detailUser', reader.id)
      .select('project.id', 'projectId')
      .addSelect(`COALESCE(SUM(${SECONDS}),0)`, 'tracked')
      .addSelect(when(`time.source='desktop' AND ${detail}`, ACTIVE), 'active')
      .addSelect(
        when(`time.source='desktop' AND ${detail}`, `${SECONDS}-${ACTIVE}`),
        'idle',
      )
      .addSelect(
        when(`time.source<>'desktop' AND ${detail}`, SECONDS),
        'manual',
      )
      .addSelect(when(detail, 'COALESCE(time."keyboardKeys",0)'), 'keyboard')
      .addSelect(when(detail, 'COALESCE(time."mouseKeys",0)'), 'mouse')
      .addSelect(when(detail, 'COALESCE(time."mouseDistance",0)'), 'distance')
      .addSelect(when('COALESCE(time."isPaid", false)', SECONDS), 'paid')
      .addSelect(
        when('COALESCE(time."isPaid", false) AND settled.id IS NULL', SECONDS),
        'handPaid',
      )
      .groupBy('project.id')

    if (span.invoiceId) {
      qb.andWhere('time."invoiceId" = :invoice', { invoice: span.invoiceId })
    } else {
      if (span.from) qb.andWhere('time."fromAt" >= :from', { from: span.from })
      if (span.to) qb.andWhere('time."fromAt" < :to', { to: span.to })
    }
    if (span.userIds?.length) {
      qb.andWhere('time."userId" IN (:...users)', { users: span.userIds })
    }

    const rows = await qb.getRawMany()

    return new Map(
      rows.map((row) => [
        row.projectId as string,
        {
          tracked: Number(row.tracked),
          active: Number(row.active),
          idle: Number(row.idle),
          manual: Number(row.manual),
          keyboard: Number(row.keyboard),
          mouse: Number(row.mouse),
          distance: Number(row.distance),
          paid: Number(row.paid),
          handPaid: Number(row.handPaid),
        },
      ]),
    )
  }

  /**
   * Paid invoices the reader may count: all of them for an owner, their own
   * for a worker, none for a viewer. Agent lines are in these amounts. An
   * invoice falls in the span its `fromAt` does, the same rule entries follow.
   */
  private async settledCents(
    onProject: { project: Project; role: ProjectRole }[],
    reader: User,
    span: IProjectTotalsSpan,
  ): Promise<Map<string, number>> {
    const countable = onProject.filter(({ role }) => role !== 'viewer')

    if (!countable.length) return new Map()

    const owned = countable
      .filter(({ role }) => role === 'owner')
      .map(({ project }) => project.id)
    const qb = getDataSource()
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .where('invoice."projectId" IN (:...projects)', {
        projects: countable.map(({ project }) => project.id),
      })
      .andWhere('invoice.state = :paidState', { paidState: EInvoiceState.PAID })
      .andWhere(
        owned.length
          ? '(invoice."projectId" IN (:...owned) OR invoice."userId" = :reader)'
          : 'invoice."userId" = :reader',
        { owned, reader: reader.id },
      )
      .select('invoice."projectId"', 'projectId')
      .addSelect('COALESCE(SUM(invoice."amountCents"),0)', 'cents')
      .groupBy('invoice."projectId"')

    if (span.invoiceId) {
      qb.andWhere('invoice.id = :invoice', { invoice: span.invoiceId })
    } else {
      if (span.from)
        qb.andWhere('invoice."fromAt" >= :from', { from: span.from })
      if (span.to) qb.andWhere('invoice."fromAt" < :to', { to: span.to })
    }
    if (span.userIds?.length) {
      qb.andWhere('invoice."userId" IN (:...users)', { users: span.userIds })
    }

    const rows = await qb.getRawMany()

    return new Map(
      rows.map((row) => [row.projectId as string, Number(row.cents)]),
    )
  }
}

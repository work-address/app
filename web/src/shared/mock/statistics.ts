/**
 * The `/statistics/*` routes over the demo database, on the API's terms
 * (`StatisticsManager`, `StatisticsRepository`): the same scope, the same
 * visibility per role, the same review window. The rules the API keeps in
 * code - focus, hours, assisted time - come from the shared package, so the
 * two cannot drift.
 */
import {
  StatisticsInsights,
  TimeSpans,
  type Span,
} from '@work-address/statistics-core'

import {
  hasDetail,
  isOwner,
  isPublished,
  isWorker,
  projectOf,
  userOf,
  visibleProjects,
} from './shape'

import type { Db, MockProject, MockTime } from './db'

export type StatisticsQuery = {
  projectIds?: string[]
  userIds?: string[]
  from: string
  to: string
  timeZone: string
  invoiceId?: string
  app?: string
  bucket?: 'day' | 'hour'
}

/** A refusal with the status the API would answer. */
export class DemoHttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Scope = {
  db: Db
  meId: string
  query: StatisticsQuery
  projects: MockProject[]
  from: number
  to: number
  owners: Set<string>
  viewers: Set<string>
  now: number
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

// The web sends the browser's own timezone, so a local midnight is the
// reader's midnight.
const localMidnight = (day: string) => new Date(`${day}T00:00:00`).getTime()

export function statisticsScope(
  db: Db,
  meId: string,
  query: StatisticsQuery,
  now = Date.now(),
): Scope {
  if (!DAY.test(query.from ?? '') || !DAY.test(query.to ?? '')) {
    throw new DemoHttpError(
      400,
      'Use a date range of at most 366 days; to is exclusive',
    )
  }
  const from = localMidnight(query.from)
  const to = localMidnight(query.to)
  if (to <= from || (to - from) / 86_400_000 > 366) {
    throw new DemoHttpError(
      400,
      'Use a date range of at most 366 days; to is exclusive',
    )
  }
  const visible = visibleProjects(db, meId)
  let projects: MockProject[]
  if (query.projectIds?.length) {
    projects = [...new Set(query.projectIds)].map((id) => {
      const project = visible.find((p) => p.id === id)
      if (!project) {
        throw new DemoHttpError(403, 'Access denied')
      }
      return project
    })
  } else if (query.userIds?.length) {
    const onlySelf = query.userIds.every((id) => id === meId)
    projects = visible.filter(
      (p) => isOwner(p, meId) || (onlySelf && isWorker(db, p, meId)),
    )
  } else {
    projects = visible
  }
  if (
    query.userIds?.length &&
    projects.some((p) => !isOwner(p, meId)) &&
    (projects.some((p) => !isWorker(db, p, meId)) ||
      query.userIds.some((id) => id !== meId))
  ) {
    throw new DemoHttpError(403, 'Access denied')
  }
  return {
    db,
    meId,
    query,
    projects,
    from,
    to,
    owners: new Set(projects.filter((p) => isOwner(p, meId)).map((p) => p.id)),
    viewers: new Set(
      projects.filter((p) => !isWorker(db, p, meId)).map((p) => p.id),
    ),
    now,
  }
}

const seconds = (time: MockTime) =>
  Math.max(0, (Date.parse(time.toAt) - Date.parse(time.fromAt)) / 1000)

const activeSeconds = (time: MockTime) =>
  Math.min(seconds(time), Math.max(0, (time.minutesActive ?? 0) * 60))

/** Entries in the scope's projects and period, narrowed to the people asked for. */
function baseEntries(scope: Scope): MockTime[] {
  const projectIds = new Set(scope.projects.map((p) => p.id))
  const users = scope.query.userIds?.length
    ? new Set(scope.query.userIds)
    : null
  return scope.db.times.filter((time) => {
    if (!projectIds.has(time.projectId)) {
      return false
    }
    if (users && !users.has(time.userId)) {
      return false
    }
    if (scope.query.invoiceId) {
      return time.invoiceId === scope.query.invoiceId
    }
    const at = Date.parse(time.fromAt)
    return at >= scope.from && at < scope.to
  })
}

/** Time the reader may count: shared projects in full, their own elsewhere. */
const countable = (scope: Scope, time: MockTime) =>
  scope.owners.has(time.projectId) ||
  scope.viewers.has(time.projectId) ||
  time.userId === scope.meId

/** Time whose apps the reader may see: their own, or published on a shared project. */
const appVisible = (scope: Scope, time: MockTime) =>
  time.userId === scope.meId ||
  ((scope.owners.has(time.projectId) || scope.viewers.has(time.projectId)) &&
    isPublished(time, projectOf(scope.db, time.projectId)!, scope.now))

const pad = (n: number) => String(n).padStart(2, '0')

const dayOf = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The reader's day, or their hour after it, as `time/daily` keys them. */
const bucketOf = (iso: string, bucket: StatisticsQuery['bucket']) =>
  bucket === 'hour'
    ? `${dayOf(iso)}T${pad(new Date(iso).getHours())}`
    : dayOf(iso)

export function totals(scope: Scope) {
  const rows = new Map<string, Record<string, number | string>>()
  for (const time of baseEntries(scope)) {
    if (!countable(scope, time)) {
      continue
    }
    const project = projectOf(scope.db, time.projectId)!
    const detail = hasDetail(time, project, scope.meId, scope.now)
    const row = rows.get(time.projectId) ?? {
      projectId: time.projectId,
      trackedSeconds: 0,
      activeSeconds: 0,
      idleSeconds: 0,
      manualSeconds: 0,
      paidSeconds: 0,
    }
    const s = seconds(time)
    ;(row.trackedSeconds as number) += s
    if (detail && time.source === 'desktop') {
      ;(row.activeSeconds as number) += activeSeconds(time)
      ;(row.idleSeconds as number) += s - activeSeconds(time)
    }
    if (detail && time.source !== 'desktop') {
      ;(row.manualSeconds as number) += s
    }
    if (time.isPaid) {
      ;(row.paidSeconds as number) += s
    }
    rows.set(time.projectId, row)
  }
  return [...rows.values()].map((row) => {
    if (!scope.viewers.has(row.projectId as string)) {
      return row
    }
    const {
      activeSeconds: _a,
      idleSeconds: _i,
      manualSeconds: _m,
      paidSeconds: _p,
      ...rest
    } = row
    return rest
  })
}

const APP_KINDS = new Set([
  'summary',
  'daily',
  'ranking',
  'titles',
  'workers',
  'projects',
])

export function apps(scope: Scope, kind: string) {
  if (!APP_KINDS.has(kind)) {
    throw new DemoHttpError(400, 'Unknown statistics report')
  }
  if (kind === 'workers' && scope.owners.size !== scope.projects.length) {
    throw new DemoHttpError(403, 'Access denied')
  }
  if (kind === 'titles' && scope.viewers.size > 0) {
    throw new DemoHttpError(403, 'Access denied')
  }
  const rows = new Map<string, Record<string, string | number>>()
  for (const time of baseEntries(scope)) {
    if (!appVisible(scope, time)) {
      continue
    }
    for (const app of time.apps) {
      if (scope.query.app && app.name !== scope.query.app) {
        continue
      }
      const dims: Record<string, string> = { app: app.name }
      if (kind === 'daily') {
        dims.day = dayOf(time.fromAt)
      }
      if (kind === 'titles') {
        Object.assign(dims, { title: '', domain: '' })
      }
      if (kind === 'workers') {
        dims.userId = time.userId
      }
      if (kind === 'projects') {
        dims.projectId = time.projectId
      }
      const key = JSON.stringify(dims)
      const row = rows.get(key) ?? { ...dims, seconds: 0 }
      ;(row.seconds as number) += app.seconds
      rows.set(key, row)
    }
  }
  return [...rows.values()].sort(
    (a, b) => (b.seconds as number) - (a.seconds as number),
  )
}

export const overview = (scope: Scope) => ({
  totals: totals(scope),
  apps: apps(scope, 'projects'),
  gaps: [],
})

export function timeDaily(scope: Scope) {
  const rows = new Map<
    string,
    { day: string; projectId: string; trackedSeconds: number }
  >()
  for (const time of baseEntries(scope)) {
    if (!countable(scope, time)) {
      continue
    }
    const day = bucketOf(time.fromAt, scope.query.bucket)
    const key = `${day}:${time.projectId}`
    const row = rows.get(key) ?? {
      day,
      projectId: time.projectId,
      trackedSeconds: 0,
    }
    row.trackedSeconds += seconds(time)
    rows.set(key, row)
  }
  return [...rows.values()]
    .map((row) => ({ ...row, trackedSeconds: Math.round(row.trackedSeconds) }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

/** The reader's own entries: insights describe them, whoever is selected. */
function ownEntries(db: Db, meId: string, query: StatisticsQuery, now: number) {
  const scope = statisticsScope(db, meId, { ...query, userIds: undefined }, now)
  return baseEntries({
    ...scope,
    query: { ...scope.query, userIds: [meId] },
  }).map((time) => ({
    fromAt: new Date(time.fromAt),
    toAt: new Date(time.toAt),
    activeSeconds: time.source === 'desktop' ? activeSeconds(time) : null,
    keyboardKeys: time.keyboardKeys,
    mouseKeys: time.mouseKeys,
  }))
}

export const timeHourly = (
  db: Db,
  meId: string,
  query: StatisticsQuery,
  now = Date.now(),
) => ({
  rows: StatisticsInsights.hourly(
    ownEntries(db, meId, query, now),
    query.timeZone,
  ),
})

export const insightsMe = (
  db: Db,
  meId: string,
  query: StatisticsQuery,
  now = Date.now(),
) => StatisticsInsights.me(ownEntries(db, meId, query, now), query.timeZone)

/** Runs every worker made on owned projects, the reader's own elsewhere, none on viewed ones. */
function agentRuns(scope: Scope, only?: Set<string>) {
  const users = scope.query.userIds?.length
    ? new Set(scope.query.userIds)
    : null
  const ids = new Set(scope.projects.map((p) => p.id))
  return scope.db.runs.filter((run) => {
    if (!ids.has(run.projectId) || (only && !only.has(run.projectId))) {
      return false
    }
    if (scope.viewers.has(run.projectId)) {
      return false
    }
    if (!scope.owners.has(run.projectId) && run.userId !== scope.meId) {
      return false
    }
    if (users && !users.has(run.userId)) {
      return false
    }
    return (
      Date.parse(run.toAt) > scope.from && Date.parse(run.fromAt) < scope.to
    )
  })
}

export function agentsDaily(scope: Scope) {
  const runs = agentRuns(scope)
  const people = new Set(runs.map((run) => run.userId))
  const projects = new Set(runs.map((run) => run.projectId))
  const human = scope.db.times
    .filter(
      (time) =>
        people.has(time.userId) &&
        projects.has(time.projectId) &&
        Date.parse(time.toAt) > scope.from &&
        Date.parse(time.fromAt) < scope.to,
    )
    .map((time) => ({
      userId: time.userId,
      projectId: time.projectId,
      span: [Date.parse(time.fromAt), Date.parse(time.toAt)] as Span,
    }))
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
    daily: StatisticsInsights.agentDaily(
      runs,
      human,
      [scope.from, scope.to],
      scope.query.timeZone,
      scope.query.bucket ?? 'day',
    ),
    runs: [...counts.values()].sort(
      (a, b) =>
        a.product.localeCompare(b.product) || a.status.localeCompare(b.status),
    ),
  }
}

export function team(scope: Scope) {
  if (scope.owners.size === 0) {
    throw new DemoHttpError(403, 'Access denied')
  }
  const rows = new Map<
    string,
    {
      userId: string
      name: string
      trackedSeconds: number
      activeSeconds: number
      unpaidSeconds: number
      agentSeconds: number
    }
  >()
  const row = (userId: string) => {
    let current = rows.get(userId)
    if (!current) {
      const user = userOf(scope.db, userId)
      current = {
        userId,
        name: user?.name || user?.address || userId,
        trackedSeconds: 0,
        activeSeconds: 0,
        unpaidSeconds: 0,
        agentSeconds: 0,
      }
      rows.set(userId, current)
    }
    return current
  }
  for (const time of baseEntries(scope)) {
    if (!scope.owners.has(time.projectId)) {
      continue
    }
    const project = projectOf(scope.db, time.projectId)!
    const person = row(time.userId)
    person.trackedSeconds += seconds(time)
    if (
      time.source === 'desktop' &&
      hasDetail(time, project, scope.meId, scope.now)
    ) {
      person.activeSeconds += activeSeconds(time)
    }
    if (!time.isPaid) {
      person.unpaidSeconds += seconds(time)
    }
  }
  const byAgent = new Map<string, Span[]>()
  for (const run of agentRuns(scope, scope.owners)) {
    const key = `${run.userId}|${run.agentId}`
    byAgent.set(key, [
      ...(byAgent.get(key) ?? []),
      ...run.segments
        .filter((s) => s.state === 'running')
        .map((s): Span => [Date.parse(s.fromAt), Date.parse(s.toAt)]),
    ])
  }
  for (const [key, spans] of byAgent) {
    const ms = TimeSpans.ms(
      TimeSpans.intersect(TimeSpans.union(spans), [[scope.from, scope.to]]),
    )
    row(key.split('|')[0]).agentSeconds += ms / 1000
  }
  return {
    rows: [...rows.values()]
      .map((r) => ({
        ...r,
        trackedSeconds: Math.round(r.trackedSeconds),
        activeSeconds: Math.round(r.activeSeconds),
        unpaidSeconds: Math.round(r.unpaidSeconds),
        agentSeconds: Math.round(r.agentSeconds),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

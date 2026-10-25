/**
 * Who may see what, and the rows as the API sends them. The rules follow the
 * API: `Project.isOwner/isWorker/isViewer` (collaborators count only while the
 * owner is premium) and `TimeVisibility` (another worker's detail reaches the
 * owner after their review window; viewers never get it).
 */
import { demoScreenshots } from './images'

import type {
  Db,
  MockInvoice,
  MockProject,
  MockRun,
  MockTime,
  MockUser,
} from './db'

const HOUR_MS = 3_600_000

export const userOf = (db: Db, id: string) =>
  db.users.find((user) => user.id === id)

export const projectOf = (db: Db, id: string) =>
  db.projects.find((project) => project.id === id && !project.deletedAt)

const ownerPremium = (db: Db, project: MockProject) =>
  userOf(db, project.ownerId)?.premium ?? false

export const isOwner = (project: MockProject, userId: string) =>
  project.ownerId === userId

export const isWorker = (db: Db, project: MockProject, userId: string) =>
  isOwner(project, userId) ||
  (project.workerIds.includes(userId) && ownerPremium(db, project))

export const isViewer = (db: Db, project: MockProject, userId: string) =>
  isWorker(db, project, userId) ||
  (project.viewerIds.includes(userId) && ownerPremium(db, project))

/** Every live project the user owns, works on or views. */
export const visibleProjects = (db: Db, userId: string) =>
  db.projects.filter(
    (project) => !project.deletedAt && isViewer(db, project, userId),
  )

/** Published by the author, invoiced, or past the project's review window. */
export const isPublished = (
  time: MockTime,
  project: MockProject,
  now = Date.now(),
) =>
  Boolean(
    time.publishedAt ||
      time.invoiceId ||
      Date.parse(time.toAt) + project.reviewWindowHours * HOUR_MS <= now,
  )

/** The author always; the owner once published; nobody else. */
export const hasDetail = (
  time: MockTime,
  project: MockProject,
  userId: string,
  now = Date.now(),
) =>
  time.userId === userId ||
  (project.ownerId === userId && isPublished(time, project, now))

export const shapeUser = (user: MockUser) => ({ ...user })

const shapeProjectCore = (db: Db, project: MockProject) => {
  const owner = userOf(db, project.ownerId)
  const address = (id: string) => userOf(db, id)?.address ?? ''
  const {
    ownerId: _owner,
    workerIds,
    viewerIds,
    deletedAt: _deleted,
    ...rest
  } = project
  return {
    ...rest,
    workerAddresses: workerIds.map(address),
    viewerAddresses: viewerIds.map(address),
    user: owner ? shapeUser(owner) : undefined,
  }
}

export const shapeProject = (db: Db, project: MockProject, meId: string) => ({
  ...shapeProjectCore(db, project),
  workers: project.workerIds
    .map((id) => userOf(db, id))
    .filter(Boolean)
    .map((user) => shapeUser(user!)),
  viewers: project.viewerIds
    .map((id) => userOf(db, id))
    .filter(Boolean)
    .map((user) => shapeUser(user!)),
  agents: [],
  canTrack: isWorker(db, project, meId),
})

/** A time entry as `TimeVisibility.redact` leaves it for this reader. */
export const shapeTime = (
  db: Db,
  time: MockTime,
  meId: string,
  now = Date.now(),
) => {
  const project = projectOf(db, time.projectId)!
  const author = userOf(db, time.userId)
  const { projectId: _p, userId: _u, invoiceId: _i, screenshot, ...rest } = time
  const base = {
    ...rest,
    project: shapeProjectCore(db, project),
    user: author ? shapeUser(author) : undefined,
    screenshot: screenshot === null ? undefined : demoScreenshots()[screenshot],
    processes: [] as unknown[],
    appsReason: null,
    appsTruncated: false,
    apps: time.apps.map((app) => ({ ...app, titles: [] })),
  }
  if (hasDetail(time, project, meId, now)) {
    return base
  }
  return {
    ...base,
    note: null,
    minutesActive: null,
    keyboardKeys: null,
    mouseKeys: null,
    mouseDistance: null,
    screenshot: undefined,
    processes: null,
    apps: undefined,
    detailPendingReview:
      project.ownerId === meId && !isPublished(time, project, now),
  }
}

const invoiceMinutes = (db: Db, invoice: MockInvoice) => {
  const entries = db.times.filter((time) => invoice.timeIds.includes(time.id))
  return {
    entries,
    minutes: entries.length * 10,
    active: entries.reduce((sum, e) => sum + (e.minutesActive ?? 0), 0),
    manual: entries
      .filter((e) => e.source !== 'desktop')
      .reduce((sum) => sum + 10, 0),
  }
}

export const shapeInvoice = (
  db: Db,
  invoice: MockInvoice,
  meId: string,
  full = false,
) => {
  const project =
    projectOf(db, invoice.projectId) ??
    db.projects.find((p) => p.id === invoice.projectId)!
  const author = userOf(db, invoice.userId)
  const { entries, minutes, active, manual } = invoiceMinutes(db, invoice)
  const billed =
    minutes ||
    Math.round((invoice.amountCents * 60) / Math.max(1, invoice.rateHourCents))
  const shaped = {
    id: invoice.id,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    project: shapeProjectCore(db, project),
    user: author ? shapeUser(author) : undefined,
    fromAt: invoice.fromAt,
    toAt: invoice.toAt,
    amountCents: invoice.amountCents,
    state: invoice.state,
    lines: [
      {
        kind: 'human',
        name: 'Human time',
        basis: 'tracked',
        minutes: billed,
        amountCents: invoice.amountCents,
        rateChanges: [],
        activeMinutes: active,
        manualMinutes: manual,
        rateHourCents: invoice.rateHourCents,
      },
    ],
    rejectionReason: invoice.rejectionReason,
    rejectedAt: invoice.rejectedAt,
    paidAt: invoice.paidAt,
  }
  if (!full) {
    return shaped
  }
  const sum = (key: 'keyboardKeys' | 'mouseKeys' | 'mouseDistance') =>
    entries.reduce((total, e) => total + (e[key] ?? 0), 0)
  return {
    ...shaped,
    time: entries.map((entry) => {
      const {
        project: _p,
        user: _u,
        apps: _a,
        ...rest
      } = shapeTime(db, entry, meId)
      return rest
    }),
    report: {
      rateHour: invoice.rateHourCents / 100,
      rateTotal: invoice.amountCents / 100,
      minutes: billed,
      minutesActive: active,
      minutesPaid: invoice.state === 'PAID' ? billed : 0,
      minutesUnpaid: invoice.state === 'PAID' ? 0 : billed,
      keyboardKeys: sum('keyboardKeys'),
      mouseKeys: sum('mouseKeys'),
      mouseDistance: sum('mouseDistance'),
    },
  }
}

/**
 * A run as agent search sends it: another worker's prompt is held from the
 * owner until their review window passes or the run is invoiced.
 */
export const shapeRun = (
  db: Db,
  run: MockRun,
  meId: string,
  now = Date.now(),
) => {
  const project = projectOf(db, run.projectId)
  const window = (project?.reviewWindowHours ?? 24) * HOUR_MS
  const held =
    run.userId !== meId &&
    !run.invoiceId &&
    !run.released &&
    Date.parse(run.toAt) + window > now
  return {
    deletedAt: null,
    ...run,
    sourceInstanceId: run.agentId,
    sourceSessionId: 'demo',
    sourceRunId: run.runKey,
    sourceAgentId: 'demo',
    measurement: {
      mode: 'timer',
      coverage: 'run',
      qualification: 'unqualified',
    },
    manual: false,
    prompt: held ? null : run.prompt,
    ...(held && run.prompt ? { promptPendingReview: true } : {}),
  }
}

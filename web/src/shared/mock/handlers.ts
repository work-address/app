/**
 * Every API route the web calls, answered from the demo database. Each
 * handler goes through `route`, which applies the network settings, the
 * session and the API's error statuses, so a handler only says what the API
 * would answer.
 */
import { http, HttpResponse, delay, type HttpHandler } from 'msw'

import { DEMO_ACCESS_TOKEN, DEMO_REFRESH_TOKEN, signInDemo } from './session'
import { readDemoSettings, writeDemoSettings } from './settings'
import {
  hasDetail,
  isOwner,
  isViewer,
  isWorker,
  projectOf,
  shapeInvoice,
  shapeProject,
  shapeRun,
  shapeTime,
  shapeUser,
  userOf,
  visibleProjects,
} from './shape'
import {
  agentsDaily,
  apps,
  DemoHttpError,
  insightsMe,
  overview,
  statisticsScope,
  team,
  timeDaily,
  timeHourly,
  type StatisticsQuery,
} from './statistics'
import { demoDb, removeRows, saveRow } from './store'

import type { Db, MockInvoice, MockProject, MockTime, MockUser } from './db'

type Ctx = {
  request: Request
  params: Record<string, string>
  body: Record<string, unknown>
  db: Db
  meId: string
  /** The signed-in user; set on every route that needs a session. */
  me: MockUser
}

type Handler = (ctx: Ctx) => unknown

const NETWORK_DELAY = { instant: 0, fast: 120, slow: 1600 } as const

const api = (path: string) => `*/api${path}`

const fail = (status: number, message: string) => {
  throw new DemoHttpError(status, message)
}

function route(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  handler: Handler,
  { auth = true }: { auth?: boolean } = {},
): HttpHandler {
  return http[method](api(path), async ({ request, params }) => {
    const settings = readDemoSettings()
    await delay(NETWORK_DELAY[settings.network.speed])
    if (settings.network.failNext) {
      writeDemoSettings({ network: { ...settings.network, failNext: false } })
      return HttpResponse.json(
        { message: 'Demo: the next request fails' },
        { status: 500 },
      )
    }
    if (settings.network.failure === 'all') {
      return HttpResponse.json(
        { message: 'Demo: every request fails' },
        { status: 500 },
      )
    }
    const db = demoDb()
    const signedIn =
      !settings.signedOut &&
      request.headers.get('authorization') === DEMO_ACCESS_TOKEN
    if (auth && !signedIn) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
    let body: Record<string, unknown> = {}
    if (method !== 'get') {
      try {
        body = (await request.json()) as Record<string, unknown>
      } catch {
        body = {}
      }
    }
    try {
      const result = await handler({
        request,
        params: params as Record<string, string>,
        body: body ?? {},
        db,
        meId: db.meId,
        me: userOf(db, db.meId)!,
      })
      return result instanceof Response
        ? result
        : HttpResponse.json(result ?? null)
    } catch (error) {
      if (error instanceof DemoHttpError) {
        return HttpResponse.json(
          { message: error.message, name: 'DemoError' },
          { status: error.status },
        )
      }
      throw error
    }
  })
}

const withTokens = (body: unknown) =>
  HttpResponse.json(body as never, {
    headers: {
      Authorization: DEMO_ACCESS_TOKEN,
      'Refresh-Token': DEMO_REFRESH_TOKEN,
      'Access-Control-Expose-Headers': 'Authorization, Refresh-Token',
    },
  })

/** `[items, total]` for a search page, as every search route answers. */
const page = <T>(items: T[], body: Record<string, unknown>) => {
  const limit = Number(body.limit) || 20
  const index = Number(body.page) || 0
  return [items.slice(index * limit, (index + 1) * limit), items.length]
}

const compare = (a: unknown, b: unknown) =>
  a === b
    ? 0
    : a === null || a === undefined
      ? 1
      : b === null || b === undefined
        ? -1
        : a < b
          ? -1
          : 1

function sortBy<T>(
  rows: T[],
  sort: unknown,
  read: (row: T, key: string) => unknown,
) {
  const [key, direction] =
    Object.entries((sort ?? {}) as Record<string, string>)[0] ?? []
  if (!key) {
    return rows
  }
  const sign = direction === 'DESC' ? -1 : 1
  return [...rows].sort((a, b) => sign * compare(read(a, key), read(b, key)))
}

const userByAddress = (db: Db, address: string) =>
  db.users.find((user) => user.address.toLowerCase() === address.toLowerCase())

/** Collaborator addresses as users, adding someone new for an unknown address. */
function idsForAddresses(db: Db, addresses: unknown): string[] {
  if (!Array.isArray(addresses)) {
    return []
  }
  return addresses.map((address: string) => {
    const known = userByAddress(db, address)
    if (known) {
      return known.id
    }
    const now = new Date().toISOString()
    return saveRow('users', {
      ...userOf(db, db.meId)!,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      address,
      name: '',
      email: null,
      premium: false,
    }).id
  })
}

const PROJECT_FIELDS = [
  'title',
  'text',
  'rateHour',
  'state',
  'trackScreenshots',
  'trackProcesses',
  'trackAgents',
  'trackWindowTitles',
  'trackBrowserDomains',
  'allowManualTime',
  'reviewWindowHours',
  'screenshotRetentionDays',
] as const

function applyProjectBody(
  db: Db,
  project: MockProject,
  body: Record<string, unknown>,
) {
  for (const field of PROJECT_FIELDS) {
    if (field in body) {
      ;(project as Record<string, unknown>)[field] = body[field]
    }
  }
  if (typeof project.rateHour === 'number') {
    project.rateHour = Number(project.rateHour).toFixed(2)
  }
  if ('workerAddresses' in body) {
    project.workerIds = idsForAddresses(db, body.workerAddresses)
  }
  if ('viewerAddresses' in body) {
    project.viewerIds = idsForAddresses(db, body.viewerAddresses)
  }
  project.updatedAt = new Date().toISOString()
  return project
}

const visibleTimes = (db: Db, meId: string) => {
  const projects = new Set(visibleProjects(db, meId).map((p) => p.id))
  return db.times.filter((time) => projects.has(time.projectId))
}

const DETAIL_FILTERS = [
  'screenshot',
  'withScreenshots',
  'withProcesses',
  'note',
  'keyboardKeysFrom',
  'keyboardKeysTo',
  'minutesActiveFrom',
  'minutesActiveTo',
  'mouseKeysFrom',
  'mouseKeysTo',
  'mouseDistanceFrom',
  'mouseDistanceTo',
]

function searchTimes({ db, meId, body }: Ctx) {
  const filter = (body.filter ?? {}) as Record<string, unknown>
  const has = (key: string) => filter[key] !== undefined && filter[key] !== null
  const needsDetail = DETAIL_FILTERS.some(has)
  const range = (value: number | null, key: string) =>
    (!has(`${key}From`) ||
      (value ?? -Infinity) >= Number(filter[`${key}From`])) &&
    (!has(`${key}To`) || (value ?? Infinity) <= Number(filter[`${key}To`]))
  const rows = visibleTimes(db, meId).filter((time) => {
    const project = projectOf(db, time.projectId)!
    if (needsDetail && !hasDetail(time, project, meId)) {
      return false
    }
    if (has('projectId') && time.projectId !== filter.projectId) {
      return false
    }
    if (
      has('fromAt') &&
      Date.parse(time.fromAt) < Date.parse(String(filter.fromAt))
    ) {
      return false
    }
    if (
      has('toAt') &&
      Date.parse(time.toAt) > Date.parse(String(filter.toAt))
    ) {
      return false
    }
    if (
      has('note') &&
      !(time.note ?? '')
        .toLowerCase()
        .includes(String(filter.note).toLowerCase())
    ) {
      return false
    }
    if (
      has('withScreenshots') &&
      Boolean(filter.withScreenshots) !== (time.screenshot !== null)
    ) {
      return false
    }
    if (
      has('withProcesses') &&
      Boolean(filter.withProcesses) !== time.apps.length > 0
    ) {
      return false
    }
    return (
      range(time.minutesActive, 'minutesActive') &&
      range(time.keyboardKeys, 'keyboardKeys') &&
      range(time.mouseKeys, 'mouseKeys') &&
      range(time.mouseDistance, 'mouseDistance')
    )
  })
  const sorted = sortBy(rows, body.sort, (time, key) =>
    key === 'projectName'
      ? projectOf(db, time.projectId)?.title
      : key === 'paidStatus'
        ? time.isPaid
        : key === 'screenshot'
          ? time.screenshot
          : (time as Record<string, unknown>)[key],
  )
  const [items, total] = page(sorted, body)
  return [(items as MockTime[]).map((time) => shapeTime(db, time, meId)), total]
}

/** Entries the reader may change: their own, or any on a project they own. */
function editableTimes(db: Db, meId: string, ids: unknown) {
  const wanted = new Set(Array.isArray(ids) ? (ids as string[]) : [])
  const rows = db.times.filter((time) => wanted.has(time.id))
  for (const time of rows) {
    const project = projectOf(db, time.projectId)
    if (!project || (time.userId !== meId && !isOwner(project, meId))) {
      fail(403, 'Access denied')
    }
  }
  return rows
}

const visibleInvoices = (db: Db, meId: string) =>
  db.invoices.filter((invoice) => {
    const project = db.projects.find((p) => p.id === invoice.projectId)
    return invoice.userId === meId || (project && isOwner(project, meId))
  })

function ownedInvoice(db: Db, meId: string, id: string) {
  const invoice = db.invoices.find((i) => i.id === id)
  const project = invoice && db.projects.find((p) => p.id === invoice.projectId)
  if (!invoice || !project) {
    fail(404, 'Invoice not found')
  }
  if (!isOwner(project!, meId)) {
    fail(403, 'Access denied')
  }
  return invoice!
}

function setInvoiceState(
  db: Db,
  invoice: MockInvoice,
  state: MockInvoice['state'],
  reason?: string,
) {
  const now = new Date().toISOString()
  const next: MockInvoice = {
    ...invoice,
    state,
    updatedAt: now,
    paidAt: state === 'PAID' ? now : null,
    rejectedAt: state === 'REJECTED' ? now : null,
    rejectionReason: state === 'REJECTED' ? (reason ?? null) : null,
    timeIds: state === 'REJECTED' ? [] : invoice.timeIds,
  }
  for (const time of db.times.filter((t) => invoice.timeIds.includes(t.id))) {
    saveRow('times', {
      ...time,
      isPaid: state === 'PAID',
      invoiceId: state === 'REJECTED' ? null : invoice.id,
    })
  }
  return saveRow('invoices', next)
}

const statistics = (
  path: string,
  answer: (ctx: Ctx, query: StatisticsQuery) => unknown,
) => route('post', path, (ctx) => answer(ctx, ctx.body as StatisticsQuery))

export const handlers: HttpHandler[] = [
  // Auth: any sign-in signs in as the demo's chosen role.
  route('get', '/auth/status', ({ me }) => shapeUser(me)),
  route('post', '/auth/nonce', () => ({ nonce: crypto.randomUUID() }), {
    auth: false,
  }),
  route('post', '/auth/ton/nonce', () => ({ nonce: crypto.randomUUID() }), {
    auth: false,
  }),
  ...['/auth/eth', '/auth/solana', '/auth/ton'].map((path) =>
    route(
      'post',
      path,
      ({ db }) => {
        signInDemo()
        return withTokens(shapeUser(userOf(db, db.meId)!))
      },
      { auth: false },
    ),
  ),
  route(
    'post',
    '/auth/refresh',
    () =>
      readDemoSettings().signedOut
        ? HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
        : withTokens({}),
    { auth: false },
  ),
  route('get', '/auth/timeTracker/:nonce', ({ params }) => ({
    nonce: params.nonce,
  })),
  route('post', '/auth/timeTracker/:nonce/connect', () => ({
    connected: true,
  })),

  // Profile.
  route(
    'get',
    '/user/:address/address',
    ({ db, params }) => {
      const user = userByAddress(db, params.address)
      if (!user) {
        fail(404, 'User does not exist')
      }
      return shapeUser(user!)
    },
    { auth: false },
  ),
  route('put', '/user', ({ me, body }) => {
    const { id: _id, address: _a, roles: _r, premium: _p, ...fields } = body
    return shapeUser(
      saveRow('users', {
        ...me,
        ...fields,
        updatedAt: new Date().toISOString(),
      } as MockUser),
    )
  }),

  // Projects.
  route('post', '/project/search', ({ db, meId, body }) => {
    const filter = (body.filter ?? {}) as Record<string, unknown>
    const rows = visibleProjects(db, meId).filter(
      (p) =>
        (!filter.state || p.state === filter.state) &&
        (!filter.projectId || p.id === filter.projectId) &&
        (!filter.userId || p.ownerId === filter.userId) &&
        (!filter.title ||
          p.title.toLowerCase().includes(String(filter.title).toLowerCase())),
    )
    const [items, total] = page(
      sortBy(rows, body.sort, (p, key) => (p as Record<string, unknown>)[key]),
      body,
    )
    return [
      (items as MockProject[]).map((p) => shapeProject(db, p, meId)),
      total,
    ]
  }),
  route('post', '/project', ({ db, meId, body }) => {
    const now = new Date().toISOString()
    const project = applyProjectBody(
      db,
      {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        title: '',
        text: '',
        rateHour: '0.00',
        state: 'Active',
        ownerId: meId,
        workerIds: [],
        viewerIds: [],
        trackScreenshots: false,
        trackProcesses: false,
        trackAgents: false,
        trackWindowTitles: false,
        trackBrowserDomains: false,
        allowManualTime: false,
        reviewWindowHours: 24,
        screenshotRetentionDays: null,
        deletedAt: null,
      },
      body,
    )
    return shapeProject(db, saveRow('projects', project), meId)
  }),
  route('put', '/project/:id', ({ db, meId, params, body }) => {
    const project = projectOf(db, params.id)
    if (!project) {
      fail(404, 'Project not found')
    }
    if (!isOwner(project!, meId)) {
      fail(403, 'Access denied')
    }
    return shapeProject(
      db,
      saveRow('projects', applyProjectBody(db, { ...project! }, body)),
      meId,
    )
  }),
  route('delete', '/project/:id', ({ db, meId, params }) => {
    const project = projectOf(db, params.id)
    if (!project) {
      fail(404, 'Project not found')
    }
    if (!isOwner(project!, meId)) {
      fail(403, 'Access denied')
    }
    saveRow('projects', { ...project!, deletedAt: new Date().toISOString() })
    return { success: true }
  }),
  route('get', '/project/:id/stats/:period', ({ db, meId, params }) => {
    const project = projectOf(db, params.id)
    if (!project || !isViewer(db, project, meId)) {
      fail(403, 'Access denied')
    }
    const days = { '7D': 7, '1M': 30, '1Y': 365 }[params.period] ?? 30
    const since = Date.now() - days * 86_400_000
    const byApp = new Map<string, number>()
    for (const time of db.times) {
      if (time.projectId !== params.id || Date.parse(time.fromAt) < since) {
        continue
      }
      if (!hasDetail(time, project!, meId)) {
        continue
      }
      for (const app of time.apps) {
        byApp.set(app.name, (byApp.get(app.name) ?? 0) + app.seconds)
      }
    }
    return [...byApp]
      .sort((a, b) => b[1] - a[1])
      .map(([processName, seconds]) => ({
        processName,
        timeMin: seconds / 60,
        period: params.period,
      }))
  }),

  // Time.
  route('post', '/time/search', searchTimes),
  route('get', '/time/totals/:id/project', ({ db, meId, params }) => {
    const project = projectOf(db, params.id)
    if (!project || !isViewer(db, project, meId)) {
      fail(403, 'Access denied')
    }
    const entries = db.times.filter((t) => t.projectId === params.id)
    if (entries.length === 0) {
      return []
    }
    const minutes = (list: MockTime[]) =>
      Math.round(
        list.reduce(
          (sum, t) =>
            sum + (Date.parse(t.toAt) - Date.parse(t.fromAt)) / 60_000,
          0,
        ),
      )
    const detail = entries.filter((t) => hasDetail(t, project!, meId))
    const sum = (
      key: 'minutesActive' | 'keyboardKeys' | 'mouseKeys' | 'mouseDistance',
    ) =>
      detail.length > 0
        ? detail.reduce((total, t) => total + (t[key] ?? 0), 0)
        : null
    const total = minutes(entries)
    return [
      {
        projectId: project!.id,
        rateHour: project!.rateHour,
        rateTotal: (total / 60) * Number(project!.rateHour),
        minutes: total,
        minutesActive: sum('minutesActive'),
        minutesPaid: minutes(entries.filter((t) => t.isPaid)),
        minutesUnpaid: minutes(entries.filter((t) => !t.isPaid)),
        keyboardKeys: sum('keyboardKeys'),
        mouseKeys: sum('mouseKeys'),
        mouseDistance: sum('mouseDistance'),
      },
    ]
  }),
  route('put', '/time/:id', ({ db, meId, params, body }) => {
    const [time] = editableTimes(db, meId, [params.id])
    if (!time) {
      fail(404, 'Time not found')
    }
    return shapeTime(
      db,
      saveRow('times', {
        ...time,
        note: 'note' in body ? (body.note as string | null) : time.note,
        isPaid: 'isPaid' in body ? Boolean(body.isPaid) : time.isPaid,
        updatedAt: new Date().toISOString(),
      }),
      meId,
    )
  }),
  route('delete', '/time', ({ db, meId, body }) => {
    const rows = editableTimes(db, meId, body.ids)
    removeRows(
      'times',
      rows.map((t) => t.id),
    )
    return { success: true }
  }),
  ...(['paid', 'unpaid'] as const).map((state) =>
    route('post', `/time/${state}`, ({ db, meId, body }) => {
      for (const time of editableTimes(db, meId, body.ids)) {
        saveRow('times', { ...time, isPaid: state === 'paid' })
      }
      return { success: true }
    }),
  ),
  route('delete', '/time/screenshots', ({ db, meId, body }) => {
    for (const time of editableTimes(db, meId, body.ids)) {
      saveRow('times', { ...time, screenshot: null })
    }
    return { success: true }
  }),
  route('delete', '/time/processes', ({ db, meId, body }) => {
    for (const time of editableTimes(db, meId, body.ids)) {
      saveRow('times', { ...time, apps: [] })
    }
    return { success: true }
  }),

  // Invoices.
  route('post', '/invoice/search', ({ db, meId, body }) => {
    const filter = (body.filter ?? {}) as Record<string, unknown>
    const rows = visibleInvoices(db, meId).filter(
      (i) =>
        (!filter.projectId || i.projectId === filter.projectId) &&
        (!filter.state || i.state === filter.state),
    )
    const [items, total] = page(
      sortBy(rows, body.sort, (i, key) => (i as Record<string, unknown>)[key]),
      body,
    )
    return [
      (items as MockInvoice[]).map((i) => shapeInvoice(db, i, meId)),
      total,
    ]
  }),
  route('get', '/invoice/:id', ({ db, meId, params }) => {
    const invoice = visibleInvoices(db, meId).find((i) => i.id === params.id)
    if (!invoice) {
      fail(404, 'Invoice not found')
    }
    return shapeInvoice(db, invoice!, meId, true)
  }),
  route('post', '/invoice/project/:projectId', ({ db, meId, params, body }) => {
    const project = projectOf(db, params.projectId)
    if (!project || !isWorker(db, project, meId)) {
      fail(403, 'Access denied')
    }
    const wanted = new Set((body.timeIds as string[] | undefined) ?? [])
    const entries = db.times
      .filter(
        (t) => t.projectId === project!.id && t.userId === meId && !t.invoiceId,
      )
      .filter((t) => wanted.size === 0 || wanted.has(t.id))
      .sort((a, b) => a.fromAt.localeCompare(b.fromAt))
    if (entries.length === 0) {
      fail(400, 'Nothing to invoice')
    }
    const now = new Date().toISOString()
    const rateHourCents = Math.round(Number(project!.rateHour) * 100)
    const invoice = saveRow('invoices', {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      projectId: project!.id,
      userId: meId,
      fromAt: entries[0].fromAt,
      toAt: entries.at(-1)!.toAt,
      amountCents: Math.round((entries.length * 10 * rateHourCents) / 60),
      rateHourCents,
      state: 'Requested',
      rejectionReason: null,
      rejectedAt: null,
      paidAt: null,
      timeIds: entries.map((t) => t.id),
    } satisfies MockInvoice)
    for (const time of entries) {
      saveRow('times', { ...time, invoiceId: invoice.id })
    }
    return shapeInvoice(db, invoice, meId)
  }),
  route('post', '/invoice/:id/reject', ({ db, meId, params, body }) =>
    shapeInvoice(
      db,
      setInvoiceState(
        db,
        ownedInvoice(db, meId, params.id),
        'REJECTED',
        body.reason as string,
      ),
      meId,
    ),
  ),
  route('post', '/invoice/:id/paid', ({ db, meId, params }) =>
    shapeInvoice(
      db,
      setInvoiceState(db, ownedInvoice(db, meId, params.id), 'PAID'),
      meId,
    ),
  ),
  route('post', '/invoice/:id/unpaid', ({ db, meId, params }) =>
    shapeInvoice(
      db,
      setInvoiceState(db, ownedInvoice(db, meId, params.id), 'Requested'),
      meId,
    ),
  ),

  // Agent runs: everyone's on owned projects, one's own elsewhere.
  route('post', '/agent-tracking/search', ({ db, meId, body }) => {
    const projects = body.projectId
      ? [projectOf(db, String(body.projectId))].filter((p): p is MockProject =>
          Boolean(p && isWorker(db, p, meId)),
        )
      : db.projects.filter((p) => !p.deletedAt && isWorker(db, p, meId))
    if (body.projectId && projects.length === 0) {
      fail(403, 'Forbidden')
    }
    const ids = new Set(projects.map((p) => p.id))
    const owned = new Set(
      projects.filter((p) => isOwner(p, meId)).map((p) => p.id),
    )
    const rows = db.runs
      .filter(
        (run) =>
          ids.has(run.projectId) &&
          (owned.has(run.projectId) || run.userId === meId),
      )
      .filter(
        (run) =>
          !body.fromAt ||
          Date.parse(run.toAt) >= Date.parse(String(body.fromAt)),
      )
      .filter(
        (run) =>
          !body.toAt || Date.parse(run.fromAt) < Date.parse(String(body.toAt)),
      )
      .sort((a, b) => b.fromAt.localeCompare(a.fromAt))
    const offset = Number(body.offset) || 0
    return [
      rows.slice(offset, offset + 100).map((run) => shapeRun(db, run, meId)),
      rows.length,
    ]
  }),

  // Statistics, on the API's terms.
  statistics('/statistics/overview', ({ db, meId }, q) =>
    overview(statisticsScope(db, meId, q)),
  ),
  statistics('/statistics/apps/:kind', ({ db, meId, params }, q) => {
    const scope = statisticsScope(db, meId, q)
    if (scope.projects.length === 0) {
      return { rows: [] }
    }
    return { rows: apps(scope, params.kind) }
  }),
  statistics('/statistics/time/daily', ({ db, meId }, q) => ({
    rows: timeDaily(statisticsScope(db, meId, q)),
  })),
  statistics('/statistics/time/hourly', ({ db, meId }, q) =>
    timeHourly(db, meId, q),
  ),
  statistics('/statistics/insights/me', ({ db, meId }, q) =>
    insightsMe(db, meId, q),
  ),
  statistics('/statistics/agents/daily', ({ db, meId }, q) =>
    agentsDaily(statisticsScope(db, meId, q)),
  ),
  statistics('/statistics/team', ({ db, meId }, q) =>
    team(statisticsScope(db, meId, q)),
  ),
]

/** Signing out in the app: the demo remembers it across reloads. */

export { signOutDemo as demoSignOut } from './session'

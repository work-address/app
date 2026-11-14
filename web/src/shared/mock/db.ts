/**
 * The demo's database: everything the API would hold, generated for a role
 * and a world (docs/demo-mode.md). Rows are shaped like the API's entities so
 * the handlers only decide who sees what.
 *
 * Generation is deterministic for a settings key and a day: dates are relative
 * to the start of today, so "This week" always has data, and every draw comes
 * from its own seeded faker.
 */
import { DEMO_SCREENSHOT_COUNT } from './images'
import { seeded } from './random'

import type { DemoSettings, DemoWorldId } from './settings'
import type { Faker } from '@faker-js/faker'

export type MockUser = {
  id: string
  createdAt: string
  updatedAt: string
  address: string
  email: string | null
  phone: null
  name: string
  title: string | null
  company: string | null
  bio: string | null
  rate: string | null
  skills: string | null
  facebook: string | null
  linkedIn: string | null
  twitter: string | null
  instagram: string | null
  youtube: string | null
  telegram: string | null
  tz: string
  city: string | null
  country: string | null
  roles: string[]
  premium: boolean
}

export type MockProject = {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  text: string
  rateHour: string
  state: 'Active' | 'Inactive'
  ownerId: string
  workerIds: string[]
  viewerIds: string[]
  trackScreenshots: boolean
  trackProcesses: boolean
  trackAgents: boolean
  trackWindowTitles: boolean
  trackBrowserDomains: boolean
  allowManualTime: boolean
  allowMobileTime: boolean
  trackLocation: boolean
  reviewWindowHours: number
  screenshotRetentionDays: number | null
  deletedAt: string | null
  /** The demo's agents are its runs' products: `userId:product` to cents. */
  agentRates?: Record<string, number>
}

export type MockTime = {
  id: string
  createdAt: string
  updatedAt: string
  projectId: string
  userId: string
  fromAt: string
  toAt: string
  isPaid: boolean
  note: string | null
  /** Index into the drawn screenshots; null for none. */
  screenshot: number | null
  appsStatus: 'ok' | 'off' | 'unsupported' | null
  apps: { name: string; seconds: number }[]
  source: 'desktop' | 'mobile' | 'manual' | 'web'
  /** Null on all but phone entries; `ok` when `locations` holds the trail. */
  locationStatus: string | null
  locations: MockLocation[]
  publishedAt: string | null
  minutesActive: number | null
  keyboardKeys: number | null
  mouseKeys: number | null
  mouseDistance: number | null
  invoiceId: string | null
}

export type MockLocation = {
  at: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  mock: boolean
}

/** Minutes an entry spans: its own times, not an assumed slot. */
export const spanMinutes = (entries: Pick<MockTime, 'fromAt' | 'toAt'>[]) =>
  entries.reduce(
    (sum, entry) =>
      sum +
      Math.max(0, (Date.parse(entry.toAt) - Date.parse(entry.fromAt)) / 60_000),
    0,
  )

export type MockInvoiceState = 'PAID' | 'Requested' | 'REJECTED'

export type MockInvoice = {
  id: string
  createdAt: string
  updatedAt: string
  projectId: string
  userId: string
  fromAt: string
  toAt: string
  amountCents: number
  rateHourCents: number
  state: MockInvoiceState
  rejectionReason: string | null
  rejectedAt: string | null
  paidAt: string | null
  timeIds: string[]
}

export type MockSegment = {
  fromAt: string
  toAt: string
  state: 'running' | 'human_wait' | 'unknown' | 'untracked'
  evidence: string
}

export type MockRun = {
  runKey: string
  userId: string
  projectId: string
  agentId: string
  product: string
  surface: string
  fromAt: string
  toAt: string
  status: string
  segments: MockSegment[]
  prompt: string | null
  invoiceId: string | null
  isPaid: boolean
  /** Its author's review window has been let pass (the demo scenario). */
  released?: boolean
  /** Where it ran; the run key decides when unset (shape.ts). */
  mode?: 'timer' | 'fixed'
  /** Its source's session; a day's runs share one when unset. */
  sessionId?: string
}

/** An agent someone set up by hand, beside the ones their runs imply. */
export type MockAgent = {
  id: string
  userId: string
  name: string
  slug: string
  product: string
  isDefault: boolean
  bindings: string[]
  createdAt: string
  removedAt: string | null
}

/** A server's upload credential. The demo keeps no secret, only its start. */
export type MockCredential = {
  id: string
  userId: string
  instanceId: string
  label: string
  mode: 'timer' | 'fixed'
  prefix: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}

export type Db = {
  meId: string
  users: MockUser[]
  projects: MockProject[]
  times: MockTime[]
  invoices: MockInvoice[]
  runs: MockRun[]
  /** Empty until the visitor sets one up: the seed's agents are its runs' products. */
  agents: MockAgent[]
  credentials: MockCredential[]
}

type WorldShape = {
  projects: number
  /** Projects that get time; the rest are older or idle. */
  tracked: number
  days: number
  workers: number
  viewers: number
  owners: number
  /** Chance a person works a given weekday on a project. */
  dayChance: number
  hours: [number, number]
}

const SHAPES: Record<Exclude<DemoWorldId, 'random'>, WorldShape> = {
  empty: {
    projects: 0,
    tracked: 0,
    days: 0,
    workers: 0,
    viewers: 0,
    owners: 1,
    dayChance: 0,
    hours: [0, 0],
  },
  starter: {
    projects: 1,
    tracked: 1,
    days: 4,
    workers: 1,
    viewers: 0,
    owners: 1,
    dayChance: 0.8,
    hours: [1, 2],
  },
  typical: {
    projects: 4,
    tracked: 4,
    days: 24,
    workers: 3,
    viewers: 1,
    owners: 2,
    dayChance: 0.6,
    hours: [1, 4],
  },
  busy: {
    projects: 112,
    tracked: 18,
    days: 120,
    workers: 25,
    viewers: 3,
    owners: 6,
    dayChance: 0.45,
    hours: [1, 3],
  },
}

const randomShape = (f: Faker): WorldShape => ({
  projects: f.number.int({ min: 2, max: 7 }),
  tracked: 7,
  days: f.number.int({ min: 10, max: 40 }),
  workers: f.number.int({ min: 1, max: 6 }),
  viewers: f.number.int({ min: 0, max: 2 }),
  owners: f.number.int({ min: 1, max: 3 }),
  dayChance: f.number.float({ min: 0.35, max: 0.8 }),
  hours: [1, f.number.int({ min: 2, max: 5 })],
})

const APPS = [
  'Code',
  'Chrome',
  'Slack',
  'Figma',
  'Terminal',
  'Notion',
  'Zoom',
  'Linear',
]
/** The agents the shared support list records; the last three on servers only. */
const PRODUCTS = ['claude-code', 'codex', 'openclaw', 'hermes', 'kimi-code']
const SERVER_ONLY = new Set(['openclaw', 'hermes', 'kimi-code'])
/** Its server collector sends no prompt (agent-tracking-contract support). */
const NO_PROMPT = new Set(['openclaw'])
const NO_WAITS = SERVER_ONLY
const PROMPTS = [
  'Fix the flaky login test and explain the race',
  'Add pagination to the invoices endpoint',
  'Refactor the time grid to share the day heading',
  'Write a migration that backfills publishedAt',
  'Why does the dashboard summary double count paid time?',
  'Draft release notes for the desktop build',
  'Find where the review window is applied to screenshots',
  'Make the project dialog keyboard accessible',
]

/** How many projects the demo's own user tracks on. */
const MY_TRACKED_PROJECTS = 3

const SLOT_MS = 10 * 60_000
const DAY_MS = 24 * 3_600_000

const iso = (ms: number) => new Date(ms).toISOString()

function makeUser(
  f: Faker,
  createdAt: number,
  finished: boolean,
  premium: boolean,
): MockUser {
  const first = f.person.firstName()
  const last = f.person.lastName()
  const handle = `${first}${last}`.toLowerCase().replaceAll(/[^a-z]/g, '')
  return {
    id: f.string.uuid(),
    createdAt: iso(createdAt),
    updatedAt: iso(createdAt),
    address: f.finance.ethereumAddress(),
    email: finished
      ? f.internet.email({ firstName: first, lastName: last })
      : null,
    phone: null,
    name: finished ? `${first} ${last}` : '',
    title: finished ? f.person.jobTitle() : null,
    company: finished ? f.company.name() : null,
    bio: finished ? f.lorem.sentences(2) : null,
    rate: finished ? f.number.int({ min: 35, max: 160 }).toFixed(2) : null,
    skills: finished
      ? f.helpers
          .arrayElements(
            [
              'TypeScript',
              'React',
              'Node.js',
              'Design',
              'Go',
              'Postgres',
              'Rust',
            ],
            3,
          )
          .join(',')
      : null,
    facebook: null,
    linkedIn: finished ? handle : null,
    twitter: finished ? handle : null,
    instagram: null,
    youtube: null,
    telegram: finished ? handle : null,
    tz: 'UTC',
    city: finished ? f.location.city() : null,
    country: finished ? f.location.countryCode() : null,
    roles: ['ROLE_USER'],
    premium,
  }
}

/** The relation the viewer has to the n-th project, by role. */
const relationFor = (
  role: DemoSettings['role'],
  index: number,
): 'own' | 'work' | 'view' =>
  role === 'owner'
    ? 'own'
    : role === 'worker'
      ? 'work'
      : role === 'viewer'
        ? 'view'
        : index % 2 === 0
          ? 'own'
          : 'work'

/**
 * Start-of-day instants within `days`, newest last, each with how likely work
 * is that day: weekdays as the world says, weekends a quarter of it - so a
 * week that starts on a Sunday still opens with something in it.
 */
function workdays(today: number, days: number): [number, number][] {
  const out: [number, number][] = []
  for (let back = days - 1; back >= 0; back--) {
    const day = today - back * DAY_MS
    const weekday = new Date(day).getDay()
    out.push([day, weekday === 0 || weekday === 6 ? 0.25 : 1])
  }
  return out
}

export function buildDb(settings: DemoSettings, now: number): Db {
  const key = `${settings.role}:${settings.world}:${settings.world === 'random' ? settings.seed : 0}`
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const today = midnight.getTime()
  const dayKey = new Date(today).toISOString().slice(0, 10)
  const f = seeded(`${key}:world:${dayKey}`)
  const shape =
    settings.world === 'random' ? randomShape(f) : SHAPES[settings.world]
  const accountsSince = today - (shape.days + 60) * DAY_MS

  const me = makeUser(
    seeded(`${key}:me`),
    accountsSince,
    settings.profile === 'finished',
    settings.plan === 'premium',
  )
  const people = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) =>
      makeUser(seeded(`${key}:${prefix}:${i}`), accountsSince, true, true),
    )
  const owners = people('owner', shape.owners)
  const workers = people('worker', shape.workers)
  const viewers = people('viewer', shape.viewers)

  const projects = makeProjects(key, settings.role, shape, today, me.id, {
    owners,
    workers,
    viewers,
  })

  const times: MockTime[] = []
  const runs: MockRun[] = []
  const days = workdays(today, shape.days)
  // One person juggles a few projects, not every active one at once: past
  // that their own figures would add up to more hours than a day has.
  let myProjects = 0
  for (const project of projects.slice(0, shape.tracked)) {
    // The owner tracks on their own projects too; a viewer never tracks.
    const mine = project.ownerId === me.id || project.workerIds.includes(me.id)
    const tracksHere = mine && myProjects < MY_TRACKED_PROJECTS
    if (tracksHere) {
      myProjects++
    }
    const trackers = [
      ...project.workerIds.filter((id) => id !== me.id),
      ...(tracksHere ? [me.id] : []),
    ]
    for (const userId of trackers) {
      const tf = seeded(`${key}:time:${project.id}:${userId}:${dayKey}`)
      for (const [day, weight] of days) {
        if (tf.number.float() <= shape.dayChance * weight) {
          trackBlock(tf, { project, userId, day, shape, now, times, runs })
        }
      }
    }
  }

  // An agent run still going, on the viewer's newest project of their own work.
  const mine = projects.find(
    (p) =>
      p.trackAgents && (p.ownerId === me.id || p.workerIds.includes(me.id)),
  )
  if (mine && settings.role !== 'viewer') {
    const rf = seeded(`${key}:live-run:${dayKey}`)
    const start = now - 18 * 60_000
    runs.push({
      ...makeRun(rf, mine.id, me.id, start, now),
      toAt: iso(now),
      status: 'unknown',
      segments: [
        {
          state: 'running',
          fromAt: iso(start),
          toAt: iso(now),
          evidence: 'demo',
        },
      ],
    })
  }

  const invoices = makeInvoices(
    seeded(`${key}:invoices:${dayKey}`),
    projects,
    times,
    today,
  )

  return {
    meId: me.id,
    users: [me, ...owners, ...workers, ...viewers],
    projects,
    times,
    invoices,
    runs,
    agents: [],
    credentials: [],
  }
}

type People = { owners: MockUser[]; workers: MockUser[]; viewers: MockUser[] }

/** The world's projects, each related to the viewer as their role says. */
function makeProjects(
  key: string,
  role: DemoSettings['role'],
  shape: WorldShape,
  today: number,
  meId: string,
  { owners, workers, viewers }: People,
): MockProject[] {
  return Array.from({ length: shape.projects }, (_, i) => {
    const pf = seeded(`${key}:project:${i}`)
    const relation = relationFor(role, i)
    const team = pf.helpers.arrayElements(
      workers,
      Math.min(workers.length, pf.number.int({ min: 1, max: 3 })),
    )
    const created =
      today - pf.number.int({ min: shape.days, max: shape.days + 50 }) * DAY_MS
    const viewer =
      viewers.length > 0 && i % 2 === 0 ? [viewers[i % viewers.length].id] : []
    return {
      id: pf.string.uuid(),
      createdAt: iso(created),
      updatedAt: iso(created),
      title: `${pf.commerce.productAdjective()} ${pf.commerce.product()}`,
      text: pf.lorem.sentences(2),
      rateHour: pf.number.int({ min: 30, max: 150 }).toFixed(2),
      state:
        i < shape.tracked || pf.number.float() < 0.3 ? 'Active' : 'Inactive',
      ownerId: relation === 'own' ? meId : owners[i % owners.length].id,
      workerIds: [
        ...team.map((w) => w.id),
        ...(relation === 'work' ? [meId] : []),
      ],
      viewerIds: [...viewer, ...(relation === 'view' ? [meId] : [])],
      trackScreenshots: i % 3 !== 2,
      trackProcesses: i % 4 !== 3,
      trackAgents: i % 3 !== 1 || i === 0,
      trackWindowTitles: false,
      trackBrowserDomains: false,
      allowManualTime: i % 2 === 0,
      allowMobileTime: i % 3 === 0,
      trackLocation: i % 3 === 0,
      reviewWindowHours: 24,
      screenshotRetentionDays: null,
      deletedAt: null,
    } satisfies MockProject
  })
}

type Block = {
  project: MockProject
  userId: string
  day: number
  shape: WorldShape
  now: number
  times: MockTime[]
  runs: MockRun[]
}

/** One stretch of work on a day: back-to-back slots, and maybe an agent run. */
function trackBlock(
  f: Faker,
  { project, userId, day, shape, now, times, runs }: Block,
) {
  const slots = f.number.int({
    min: shape.hours[0] * 6,
    max: shape.hours[1] * 6,
  })
  const blockStart =
    day +
    f.number.int({ min: 8, max: 14 }) * 3_600_000 +
    f.number.int({ min: 0, max: 5 }) * SLOT_MS
  const drawn: MockTime['source'] =
    project.allowManualTime && f.number.float() < 0.12
      ? f.helpers.arrayElement(['manual', 'web'] as const)
      : 'desktop'
  // Every third day's tracked time on a phone project came from the phone.
  // Decided without a draw, so the rest of the world stays as it was seeded.
  const source: MockTime['source'] =
    drawn === 'desktop' &&
    project.allowMobileTime &&
    Math.floor(day / 86_400_000) % 3 === 0
      ? 'mobile'
      : drawn
  for (let s = 0; s < slots; s++) {
    const from = blockStart + s * SLOT_MS
    if (from + SLOT_MS > now) {
      break
    }
    times.push(makeEntry(f, project, userId, from, source))
  }
  // Most stretches of work have an agent beside them, some several, one after
  // another through the block - so agent charts have something to show.
  if (project.trackAgents && f.number.float() < 0.6) {
    const count = f.number.int({ min: 1, max: 3 })
    for (let run = 0; run < count; run++) {
      const start = blockStart + Math.floor((slots * run) / count) * SLOT_MS
      if (start < now) {
        runs.push(makeRun(f, project.id, userId, start, now))
      }
    }
  }
}

/** A ten-minute entry as the tracker would upload it. */
function makeEntry(
  f: Faker,
  project: MockProject,
  userId: string,
  from: number,
  source: MockTime['source'],
): MockTime {
  // Phone time takes the draws desktop time takes, then drops what a phone
  // never records, so the seeded world does not shift around it.
  const recorded = source === 'desktop' || source === 'mobile'
  const active = recorded ? f.number.int({ min: 3, max: 10 }) : null
  const tracksApps = recorded && project.trackProcesses
  const entry: MockTime = {
    id: f.string.uuid(),
    createdAt: iso(from + SLOT_MS),
    updatedAt: iso(from + SLOT_MS),
    projectId: project.id,
    userId,
    fromAt: iso(from),
    toAt: iso(from + SLOT_MS),
    isPaid: false,
    note: f.number.float() < 0.3 ? f.hacker.phrase() : null,
    screenshot:
      recorded && project.trackScreenshots && f.number.float() < 0.25
        ? f.number.int({ min: 0, max: DEMO_SCREENSHOT_COUNT - 1 })
        : null,
    appsStatus: recorded ? (tracksApps ? 'ok' : 'off') : null,
    apps: tracksApps && active ? splitApps(f, active * 60) : [],
    source,
    locationStatus: null,
    locations: [],
    publishedAt: null,
    minutesActive: active,
    keyboardKeys: recorded ? f.number.int({ min: 20, max: 900 }) : null,
    mouseKeys: recorded ? f.number.int({ min: 5, max: 260 }) : null,
    mouseDistance: recorded ? f.number.float({ min: 200, max: 5000 }) : null,
    invoiceId: null,
  }
  if (source !== 'mobile') {
    return entry
  }
  // As the API stores it: every minute active, no input, screenshot or apps.
  return {
    ...entry,
    screenshot: null,
    appsStatus: project.trackProcesses ? 'unsupported' : 'off',
    apps: [],
    minutesActive: SLOT_MS / 60_000,
    keyboardKeys: 0,
    mouseKeys: 0,
    mouseDistance: 0,
    locationStatus: project.trackLocation ? 'ok' : 'off',
    locations: project.trackLocation ? walk(userId, from) : [],
  }
}

/**
 * A phone's fixes over one slot, a minute apart: a slow walk around a point of
 * the contributor's own. Computed from the time, never drawn, so the seeded
 * world stays as it was. Every seventh minute finds no fix, and now and then
 * a fix is one the phone says was faked.
 */
function walk(userId: string, from: number): MockLocation[] {
  let seed = 0
  for (const char of userId) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0
  }
  const home = {
    latitude: 52.35 + (seed % 100) / 1000,
    longitude: 4.85 + ((seed >> 8) % 100) / 1000,
  }
  return Array.from({ length: SLOT_MS / 60_000 }, (_, index) => {
    const at = from + index * 60_000
    const minute = Math.floor(at / 60_000)
    if (minute % 7 === 0) {
      return {
        at: iso(at),
        latitude: null,
        longitude: null,
        accuracy: null,
        mock: false,
      }
    }
    return {
      at: iso(at),
      latitude:
        home.latitude +
        0.006 * Math.sin(minute / 23) +
        0.002 * Math.sin(minute / 5),
      longitude: home.longitude + 0.009 * Math.cos(minute / 31),
      accuracy: 5 + (minute % 6) * 6,
      mock: minute % 211 === 0,
    }
  })
}

function splitApps(f: Faker, seconds: number) {
  const names = f.helpers.arrayElements(APPS, f.number.int({ min: 1, max: 4 }))
  let left = seconds
  return names
    .map((name, index) => {
      const share =
        index === names.length - 1
          ? left
          : Math.round(left * f.number.float({ min: 0.3, max: 0.7 }))
      left -= share
      return { name, seconds: share }
    })
    .filter((app) => app.seconds > 0)
}

function makeRun(
  f: Faker,
  projectId: string,
  userId: string,
  start: number,
  now: number,
): MockRun {
  const running = f.number.int({ min: 10, max: 40 }) * 60_000
  const wait = f.number.int({ min: 2, max: 12 }) * 60_000
  const after = f.number.int({ min: 5, max: 50 }) * 60_000
  const end = Math.min(now, start + running + wait + after)
  const runKey = f.string.hexadecimal({
    length: 32,
    casing: 'lower',
    prefix: '',
  })
  const product = f.helpers.arrayElement(PRODUCTS)
  const prompt =
    f.number.float() < 0.85 ? f.helpers.arrayElement(PROMPTS) : null
  return {
    runKey,
    userId,
    projectId,
    agentId: f.string.uuid(),
    product,
    ...(SERVER_ONLY.has(product) ? { mode: 'fixed' as const } : {}),
    surface: 'cli',
    fromAt: iso(start),
    toAt: iso(end),
    status: f.helpers.weightedArrayElement([
      { weight: 8, value: 'completed' },
      { weight: 1, value: 'failed' },
      { weight: 1, value: 'cancelled' },
    ]),
    segments: [
      {
        state: 'running',
        fromAt: iso(start),
        toAt: iso(start + running),
        evidence: 'demo',
      },
      {
        // These collectors record no waits: the pause shows as running.
        state: NO_WAITS.has(product) ? 'running' : 'human_wait',
        fromAt: iso(start + running),
        toAt: iso(start + running + wait),
        evidence: 'demo',
      },
      {
        state: 'running',
        fromAt: iso(start + running + wait),
        toAt: iso(end),
        evidence: 'demo',
      },
    ].filter((s) => Date.parse(s.toAt) > Date.parse(s.fromAt)) as MockSegment[],
    prompt: NO_PROMPT.has(product) ? null : prompt,
    invoiceId: null,
    isPaid: false,
  }
}

/**
 * Invoices over weekly periods per project and person: paid from two weeks
 * back, requested for last week, and one rejected - so every state shows.
 */
function makeInvoices(
  f: Faker,
  projects: MockProject[],
  times: MockTime[],
  today: number,
): MockInvoice[] {
  const invoices: MockInvoice[] = []
  const byGroup = new Map<string, MockTime[]>()
  for (const time of times) {
    const age = Math.floor((today - Date.parse(time.fromAt)) / (7 * DAY_MS))
    if (age < 1) {
      continue
    }
    const group = `${time.projectId}:${time.userId}:${age}`
    byGroup.set(group, [...(byGroup.get(group) ?? []), time])
  }
  let rejected = false
  for (const [group, entries] of byGroup) {
    const [projectId, userId, age] = group.split(':')
    const project = projects.find((p) => p.id === projectId)
    if (!project) {
      continue
    }
    const rateHourCents = Math.round(Number(project.rateHour) * 100)
    const minutes = spanMinutes(entries)
    const state: MockInvoiceState =
      !rejected && Number(age) === 1 && f.number.float() < 0.5
        ? 'REJECTED'
        : Number(age) >= 2
          ? 'PAID'
          : 'Requested'
    if (state === 'REJECTED') {
      rejected = true
    }
    const createdAt = Date.parse(entries.at(-1)!.toAt) + DAY_MS
    const invoice: MockInvoice = {
      id: f.string.uuid(),
      createdAt: iso(createdAt),
      updatedAt: iso(createdAt),
      projectId,
      userId,
      fromAt: entries[0].fromAt,
      toAt: entries.at(-1)!.toAt,
      amountCents: Math.round((minutes * rateHourCents) / 60),
      rateHourCents,
      state,
      rejectionReason:
        state === 'REJECTED'
          ? 'Hours on the 14th look doubled - please split them.'
          : null,
      rejectedAt: state === 'REJECTED' ? iso(createdAt + DAY_MS) : null,
      paidAt: state === 'PAID' ? iso(createdAt + 2 * DAY_MS) : null,
      timeIds: state === 'REJECTED' ? [] : entries.map((e) => e.id),
    }
    if (state !== 'REJECTED') {
      for (const entry of entries) {
        entry.invoiceId = invoice.id
        entry.isPaid = state === 'PAID'
      }
    }
    invoices.push(invoice)
  }
  return invoices
}

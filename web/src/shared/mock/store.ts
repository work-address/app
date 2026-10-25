/**
 * The demo database for this page: the world `buildDb` generates, with the
 * visitor's edits on top. Edits are kept per role and world in localStorage
 * until Reset (docs/demo-mode.md).
 *
 * Time, invoices and runs are regenerated relative to each new day, so edits
 * to them last until midnight; edits to projects and the profile last until
 * Reset.
 */
import { buildDb, type Db } from './db'
import { demoDataKey, readDemoSettings } from './settings'

type Collection = 'users' | 'projects' | 'times' | 'invoices' | 'runs'

type Row = { id?: string; runKey?: string }

type Overrides = {
  day: string
  rows: Record<Collection, Record<string, Row | null>>
}

const DAILY: Collection[] = ['times', 'invoices', 'runs']

const rowId = (row: Row) => (row.id ?? row.runKey) as string

const emptyOverrides = (day: string): Overrides => ({
  day,
  rows: { users: {}, projects: {}, times: {}, invoices: {}, runs: {} },
})

const storageKey = () => `wa.demo.data:${demoDataKey(readDemoSettings())}`

const todayKey = (now: number) => {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  return day.toISOString().slice(0, 10)
}

function readOverrides(day: string): Overrides {
  try {
    const saved = JSON.parse(
      localStorage.getItem(storageKey()) ?? 'null',
    ) as Overrides | null
    if (!saved?.rows) {
      return emptyOverrides(day)
    }
    if (saved.day !== day) {
      for (const collection of DAILY) {
        saved.rows[collection] = {}
      }
      saved.day = day
    }
    return saved
  } catch {
    return emptyOverrides(day)
  }
}

let db: Db | null = null
let overrides: Overrides | null = null

function apply(base: Db, edits: Overrides): Db {
  for (const collection of Object.keys(edits.rows) as Collection[]) {
    const rows = base[collection] as Row[]
    const changes = edits.rows[collection]
    const kept = rows
      .filter((row) => changes[rowId(row)] !== null)
      .map((row) => (changes[rowId(row)] as Row | undefined) ?? row)
    const known = new Set(rows.map(rowId))
    const added = Object.entries(changes)
      .filter(([id, row]) => row && !known.has(id))
      .map(([, row]) => row as Row)
    ;(base[collection] as Row[]) = [...kept, ...added]
  }
  return base
}

/** The database for this page, built on first use. */
export function demoDb(now = Date.now()): Db {
  if (!db) {
    const day = todayKey(now)
    overrides = readOverrides(day)
    db = apply(buildDb(readDemoSettings(), now), overrides)
  }
  return db
}

function persist() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(overrides))
  } catch {
    // Over quota or disabled: the edit holds for this page only.
  }
}

/** Saves a new or changed row, and keeps it across reloads. */
export function saveRow<T extends Row>(collection: Collection, row: T): T {
  const current = demoDb()
  const rows = current[collection] as Row[]
  const index = rows.findIndex((r) => rowId(r) === rowId(row))
  if (index === -1) {
    rows.push(row)
  } else {
    rows[index] = row
  }
  overrides!.rows[collection][rowId(row)] = row
  persist()
  return row
}

/** Removes rows, and keeps them removed across reloads. */
export function removeRows(collection: Collection, ids: string[]) {
  const current = demoDb()
  const gone = new Set(ids)
  ;(current[collection] as Row[]) = (current[collection] as Row[]).filter(
    (row) => !gone.has(rowId(row)),
  )
  for (const id of ids) {
    overrides!.rows[collection][id] = null
  }
  persist()
}

/** Drops every edit for the current role and world. */
export function resetDemoData() {
  try {
    localStorage.removeItem(storageKey())
  } catch {
    // Nothing kept, nothing to drop.
  }
  db = null
  overrides = null
}

/** For tests: forget the built database so the next read rebuilds it. */
export function resetDemoDbForTests() {
  db = null
  overrides = null
}

import moment from 'moment-timezone'
import { AgentSegment } from '@/model/agent'
import { Span, TimeSpans } from '@/service/time-spans'

/** Gaps a focus session tolerates: one tracker slot. */
export const FOCUS_GAP_MS = 10 * 60000
/** Tracked time a stretch needs before it counts as focus. */
export const FOCUS_MIN_MS = 45 * 60000

export interface InsightEntry {
  fromAt: Date
  toAt: Date
  /** Null where activity was not measured: manual and web time. */
  activeSeconds: number | null
  keyboardKeys: number | null
  mouseKeys: number | null
}

export interface HourlyRow {
  /** ISO weekday: 1 is Monday. */
  weekday: number
  hour: number
  activeSeconds: number
}

export interface AgentRunInput {
  userId: string
  projectId: string
  agentId: string
  product: string
  status: string
  segments: AgentSegment[]
}

export interface AgentDailyRow {
  day: string
  product: string
  assistedSeconds: number
  autonomousSeconds: number
  waitSeconds: number
}

/**
 * Pure figures behind the dashboard's insights. Kept apart from the queries
 * so the rules - what counts as focus, what counts as assisted - are tested
 * on their own.
 */
export class StatisticsInsights {
  /**
   * Stretches of tracked time where no gap is longer than one slot, at least
   * 45 tracked minutes long. Gaps are tolerated but never counted.
   */
  public static focusSessions(
    entries: Span[],
    gapMs = FOCUS_GAP_MS,
    minMs = FOCUS_MIN_MS,
  ) {
    const spans = TimeSpans.union(entries)
    const sessions: number[] = []
    let tracked = 0
    let lastEnd: number | null = null
    for (const [start, end] of spans) {
      if (lastEnd !== null && start - lastEnd > gapMs) {
        sessions.push(tracked)
        tracked = 0
      }
      tracked += end - start
      lastEnd = end
    }
    if (lastEnd !== null) sessions.push(tracked)
    const focus = sessions.filter((ms) => ms >= minMs)
    return {
      count: focus.length,
      minutes: Math.round(focus.reduce((a, b) => a + b, 0) / 60000),
      longestMinutes: Math.round(Math.max(0, ...focus) / 60000),
    }
  }

  /** Active time by weekday and hour, in the reader's timezone. */
  public static hourly(entries: InsightEntry[], timeZone: string): HourlyRow[] {
    const cells = new Map<string, HourlyRow>()
    for (const entry of entries) {
      if (!entry.activeSeconds) continue
      // An entry is one slot; its start places it.
      const at = moment.tz(entry.fromAt, timeZone)
      const weekday = at.isoWeekday()
      const hour = at.hour()
      const key = `${weekday}:${hour}`
      const cell = cells.get(key) ?? { weekday, hour, activeSeconds: 0 }
      cell.activeSeconds += entry.activeSeconds
      cells.set(key, cell)
    }
    return [...cells.values()].sort(
      (a, b) => a.weekday - b.weekday || a.hour - b.hour,
    )
  }

  /** The hours of the day with the most active time, best first. */
  public static productiveHours(rows: HourlyRow[], limit = 3): number[] {
    const byHour = new Map<number, number>()
    for (const row of rows)
      byHour.set(row.hour, (byHour.get(row.hour) ?? 0) + row.activeSeconds)
    return [...byHour]
      .filter(([, seconds]) => seconds > 0)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, limit)
      .map(([hour]) => hour)
  }

  public static me(entries: InsightEntry[], timeZone: string) {
    const measured = entries.filter((entry) => entry.activeSeconds !== null)
    const trackedMs = TimeSpans.ms(
      measured.map((e): Span => [+e.fromAt, +e.toAt]),
    )
    const activeSeconds = measured.reduce(
      (sum, e) => sum + (e.activeSeconds ?? 0),
      0,
    )
    const activeHours = activeSeconds / 3600
    const perActiveHour = (key: 'keyboardKeys' | 'mouseKeys') =>
      activeHours > 0
        ? Math.round(
            measured.reduce((sum, e) => sum + (e[key] ?? 0), 0) / activeHours,
          )
        : null
    return {
      focus: this.focusSessions(entries.map((e): Span => [+e.fromAt, +e.toAt])),
      productiveHours: this.productiveHours(this.hourly(entries, timeZone)),
      // Only measured time: manual entries have no activity to compare.
      activeRatio: trackedMs > 0 ? activeSeconds / (trackedMs / 1000) : null,
      keysPerActiveHour: perActiveHour('keyboardKeys'),
      clicksPerActiveHour: perActiveHour('mouseKeys'),
    }
  }

  /**
   * Agent time per day and product. Running time is assisted where the same
   * worker's own timer ran on the same project, autonomous otherwise.
   * `human_wait` is reported apart and never counts as agent time. Each
   * agent's runs are merged first, so overlapping runs of one agent count
   * once - the same rule its invoice lines follow.
   */
  public static agentDaily(
    runs: AgentRunInput[],
    human: { userId: string; projectId: string; span: Span }[],
    range: Span,
    timeZone: string,
  ): AgentDailyRow[] {
    const humanBy = new Map<string, Span[]>()
    for (const entry of human) {
      const key = `${entry.userId}:${entry.projectId}`
      humanBy.set(key, [...(humanBy.get(key) ?? []), entry.span])
    }
    const groups = new Map<string, AgentRunInput[]>()
    for (const run of runs) {
      const key = `${run.userId}:${run.projectId}:${run.agentId}:${run.product}`
      groups.set(key, [...(groups.get(key) ?? []), run])
    }
    const rows = new Map<string, AgentDailyRow>()
    const add = (
      spans: Span[],
      product: string,
      field: 'assistedSeconds' | 'autonomousSeconds' | 'waitSeconds',
    ) => {
      for (const span of spans)
        for (const [day, ms] of this.splitByDay(span, timeZone)) {
          const key = `${day}:${product}`
          const row = rows.get(key) ?? {
            day,
            product,
            assistedSeconds: 0,
            autonomousSeconds: 0,
            waitSeconds: 0,
          }
          row[field] += ms / 1000
          rows.set(key, row)
        }
    }
    for (const group of groups.values()) {
      const { userId, projectId, product } = group[0]
      const state = (name: AgentSegment['state']) =>
        TimeSpans.intersect(
          TimeSpans.union(
            group.flatMap((run) =>
              run.segments
                .filter((segment) => segment.state === name)
                .map((s): Span => [Date.parse(s.fromAt), Date.parse(s.toAt)]),
            ),
          ),
          [range],
        )
      const running = state('running')
      const own = TimeSpans.union(humanBy.get(`${userId}:${projectId}`) ?? [])
      const assisted = TimeSpans.intersect(running, own)
      add(assisted, product, 'assistedSeconds')
      add(TimeSpans.subtract(running, assisted), product, 'autonomousSeconds')
      add(
        TimeSpans.subtract(state('human_wait'), running),
        product,
        'waitSeconds',
      )
    }
    return [...rows.values()]
      .map((row) => ({
        ...row,
        assistedSeconds: Math.round(row.assistedSeconds),
        autonomousSeconds: Math.round(row.autonomousSeconds),
        waitSeconds: Math.round(row.waitSeconds),
      }))
      .sort(
        (a, b) =>
          a.day.localeCompare(b.day) || a.product.localeCompare(b.product),
      )
  }

  /** A span cut at the reader's midnights, as [day, milliseconds] pairs. */
  public static splitByDay(span: Span, timeZone: string): [string, number][] {
    const out: [string, number][] = []
    let cursor = span[0]
    while (cursor < span[1]) {
      const at = moment.tz(cursor, timeZone)
      const next = Math.min(span[1], +at.clone().startOf('day').add(1, 'day'))
      out.push([at.format('YYYY-MM-DD'), next - cursor])
      cursor = next
    }
    return out
  }
}

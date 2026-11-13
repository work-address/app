/**
 * The longest gap a session tolerates: the same ten minutes the statistics
 * use for focus sessions (`FOCUS_GAP_MS` in `@work-address/statistics-core`).
 */
export const SESSION_GAP_MS = 10 * 60_000

/** The fields of a time entry a session is read from. */
export type SessionEntry = {
  fromAt: string
  toAt: string
  /** Absent on older entries, which all came from the desktop app. */
  source?: string | null
  note?: string | null
  user?: { id?: string } | null
  project?: { id?: string; title?: string } | null
}

/** Where a session's time was tracked. */
export type SessionSource = 'desktop' | 'mobile'

export type DesktopSession = {
  /** Which app tracked it: a session never mixes the two. */
  source: SessionSource
  fromAt: Date
  toAt: Date
  /** Tracked minutes, overlaps counted once and gaps not at all. */
  minutes: number
  projectId: string | null
  projectTitle: string | null
  /** How many projects the session's time went to. */
  projectCount: number
  note: string | null
}

type Options = {
  /** The signed-in person: only their own time makes their session. */
  userId: string | null | undefined
  /** The projects the dashboard shows. */
  projectIds: readonly string[]
}

/** An entry's tracker, or null for time added by hand or in the browser. */
const trackedBy = (entry: SessionEntry): SessionSource | null => {
  const source = entry.source ?? 'desktop'

  return source === 'desktop' || source === 'mobile' ? source : null
}

/**
 * The signed-in person's latest stretch of tracked time, from the desktop app
 * or the phone: their newest such entry, joined with the earlier ones from the
 * same app no more than ten minutes apart.
 */
export function latestDesktopSession(
  entries: readonly SessionEntry[],
  { userId, projectIds }: Options,
): DesktopSession | null {
  if (!userId) {
    return null
  }

  const visible = new Set(projectIds)
  const mine = entries
    .filter(
      (entry) =>
        entry.user?.id === userId &&
        trackedBy(entry) !== null &&
        visible.has(entry.project?.id ?? ''),
    )
    .map((entry) => ({
      entry,
      from: Date.parse(entry.fromAt),
      to: Date.parse(entry.toAt),
    }))
    .filter(({ from, to }) => Number.isFinite(from) && to > from)
    .sort((a, b) => b.to - a.to)

  if (mine.length === 0) {
    return null
  }

  const source = trackedBy(mine[0].entry) ?? 'desktop'
  const same = mine.filter(({ entry }) => trackedBy(entry) === source)

  // Newest first: each earlier entry joins while it ends within the gap of
  // the session's start so far.
  const session = [same[0]]
  let start = same[0].from

  for (const span of same.slice(1)) {
    if (span.to < start - SESSION_GAP_MS) {
      break
    }
    session.push(span)
    start = Math.min(start, span.from)
  }

  const latest = session[0].entry
  const note =
    session
      .map(({ entry }) => entry.note?.trim())
      .find((text): text is string => Boolean(text)) ?? null

  return {
    source,
    fromAt: new Date(start),
    toAt: new Date(session[0].to),
    minutes: Math.round(coveredMs(session) / 60_000),
    projectId: latest.project?.id ?? null,
    projectTitle: latest.project?.title ?? null,
    projectCount: new Set(session.map(({ entry }) => entry.project?.id)).size,
    note,
  }
}

/** The time the spans cover, overlaps counted once. */
const coveredMs = (spans: readonly { from: number; to: number }[]) => {
  const sorted = [...spans].sort((a, b) => a.from - b.from)
  let total = 0
  let end = -Infinity

  for (const { from, to } of sorted) {
    if (to <= end) {
      continue
    }
    total += to - Math.max(from, end)
    end = to
  }

  return total
}

import type { ProjectWithStats } from '@/entities/projects'
import type {
  StatisticsDailyRow,
  StatisticsProjectAppRow,
  StatisticsTotalsRow,
} from '@/entities/statistics'

type Person = { id?: string; name?: string; address?: string }

/** The project fields the summary reads that the generated type leaves loose. */
export type ProjectWithAccess = ProjectWithStats & {
  user?: Person
  workers?: unknown[]
  viewers?: unknown[]
}

export type ProjectRole = 'owner' | 'worker' | 'viewer'

/** Everything the dashboard knows about one project, in minutes and money. */
export type ProjectSummary = {
  role: ProjectRole
  /** The project's state as the API names it: `Active`, `Inactive`. */
  status: string
  period: {
    trackedMinutes: number
    /** Null where the reader only views: activity and money are not theirs to see. */
    activeMinutes: number | null
    activeShare: number | null
    paidMinutes: number | null
    unpaidMinutes: number | null
    earned: number | null
    unpaid: number | null
    /** Days in the period with any time on the project. */
    days: number
  }
  allTime: {
    minutes: number
    minutesActive: number
    minutesPaid: number
    minutesUnpaid: number
    /** Paid for so far, in currency. */
    paid: number
    keyboardKeys: number
    mouseKeys: number
    mouseDistance: number
  }
  rate: number
  team: { owner: string; workers: string[]; viewers: number }
  /** The period's apps on the project, most time first. */
  apps: { name: string; minutes: number }[]
  tracking: {
    screenshots: boolean
    apps: boolean
    agents: boolean
    manual: boolean
    reviewWindowHours: number
  }
}

const personName = (person: unknown) => {
  const p = (person ?? {}) as Person
  return p.name || p.address || ''
}

/**
 * A project as the dashboard sees it for the period: its time and money, its
 * all-time totals, who is on it, what it tracks and what was used on it.
 */
export function projectSummary(
  project: ProjectWithAccess,
  meId: string | undefined,
  totals: StatisticsTotalsRow | undefined,
  apps: StatisticsProjectAppRow[],
  daily: StatisticsDailyRow[],
): ProjectSummary {
  const workers = project.workers ?? []
  const role: ProjectRole =
    project.user?.id && project.user.id === meId
      ? 'owner'
      : workers.some((worker) => (worker as Person).id === meId)
        ? 'worker'
        : 'viewer'
  const rate = Number(project.rateHour) || 0
  const tracked = (totals?.trackedSeconds ?? 0) / 60
  const detail = totals?.paidSeconds !== undefined
  const active = detail ? (totals?.activeSeconds ?? 0) / 60 : null
  const paid = detail ? (totals?.paidSeconds ?? 0) / 60 : null
  const unpaid = paid === null ? null : Math.max(0, tracked - paid)
  const days = new Set(
    daily
      .filter((row) => row.projectId === project.id)
      .map((row) => row.day.slice(0, 10)),
  )

  return {
    role,
    status: project.state,
    period: {
      trackedMinutes: tracked,
      activeMinutes: active,
      activeShare: active !== null && tracked > 0 ? active / tracked : null,
      paidMinutes: paid,
      unpaidMinutes: unpaid,
      earned: detail ? (tracked / 60) * rate : null,
      unpaid: unpaid === null ? null : (unpaid / 60) * rate,
      days: days.size,
    },
    allTime: {
      minutes: project.minutes || 0,
      minutesActive: project.minutesActive || 0,
      minutesPaid: project.minutesPaid || 0,
      minutesUnpaid: project.minutesUnpaid || 0,
      paid: project.paid || 0,
      keyboardKeys: project.keyboardKeys || 0,
      mouseKeys: project.mouseKeys || 0,
      mouseDistance: project.mouseDistance || 0,
    },
    rate,
    team: {
      owner: personName(project.user),
      workers: workers.map(personName).filter(Boolean),
      viewers: (project.viewers ?? []).length,
    },
    apps: apps
      .filter((row) => row.projectId === project.id)
      .map((row) => ({ name: row.app, minutes: row.seconds / 60 }))
      .sort((a, b) => b.minutes - a.minutes),
    tracking: {
      screenshots: Boolean(project.trackScreenshots),
      apps: Boolean(project.trackProcesses),
      agents: Boolean(project.trackAgents),
      manual: Boolean(project.allowManualTime),
      reviewWindowHours: project.reviewWindowHours ?? 24,
    },
  }
}

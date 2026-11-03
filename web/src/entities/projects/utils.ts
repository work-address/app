import type {
  ProjectRole,
  TimeTotalComputed,
  ProjectWithStats,
  TimeTotalsRow,
} from './types'
import type { baseApi } from '@/shared'

/** Only the owner changes a project (SPEC.md, "Who can see what"). */
export const canManageProject = (role?: ProjectRole) => role === 'owner'

/** An owner or a worker can invoice; a viewer sees no invoices at all. */
export const canInvoiceProject = (role?: ProjectRole) =>
  role === 'owner' || role === 'worker'

// Sentinel that cannot collide with a real process name from the tracker.
export const OTHER_PROCESS_NAME = '__other__'

export const normalizeProcessName = (processName?: string | null) => {
  const trimmed = processName?.trim()

  return trimmed ? trimmed : OTHER_PROCESS_NAME
}

export const mapProjectsAndStats = (
  projects: baseApi.Project[] = [],
  stats: TimeTotalsRow[] = [],
) => {
  const recordStats = stats.reduce(
    (acc, stat) => {
      if (stat?.projectId) {
        acc[stat.projectId] = stat
      }
      return acc
    },
    {} as Record<string, TimeTotalsRow>,
  )

  return projects.map((project): ProjectWithStats => {
    const stats: TimeTotalsRow =
      project?.id && recordStats[project.id]
        ? recordStats[project.id]
        : { projectId: '', minutes: 0 }

    const minutesActive = stats.minutesActive ?? 0
    const hoursTotal = (stats.minutes - (stats.minutes % 60)) / 60
    const minutesTotal = stats.minutes - hoursTotal * 60
    const hoursActiveTotal = (minutesActive - (minutesActive % 60)) / 60
    const minutesActiveTotal = minutesActive - hoursActiveTotal * 60

    const computed: TimeTotalComputed = {
      hoursTotal,
      minutesTotal,
      minutesActiveTotal,
      hoursActiveTotal,
    }
    const rate = project.rateHour ?? stats.rateHour

    return {
      ...stats,
      ...project,
      ...computed,
      // The least a project in the list can be, and it shows the reader least.
      role: project.role ?? 'viewer',
      rateHour: rate === undefined ? undefined : Number(rate),
    }
  })
}

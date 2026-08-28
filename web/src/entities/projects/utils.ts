import type {
  TimeTotalComputed,
  ProjectWithStats,
  TimeTotalsRow,
} from './types'
import type { baseApi } from '@/shared'

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
        : {
            projectId: '',
            rateHour: 0,
            rateTotal: 0,
            minutes: 0,
            keyboardKeys: 0,
            minutesActive: 0,
            minutesPaid: 0,
            minutesUnpaid: 0,
            mouseDistance: 0,
            mouseKeys: 0,
          }

    const hoursTotal = (stats.minutes - (stats.minutes % 60)) / 60
    const minutesTotal = stats.minutes - hoursTotal * 60
    const hoursActiveTotal =
      (stats.minutesActive - (stats.minutesActive % 60)) / 60
    const minutesActiveTotal = stats.minutesActive - hoursActiveTotal * 60

    const computed: TimeTotalComputed = {
      hoursTotal,
      minutesTotal,
      minutesActiveTotal,
      hoursActiveTotal,
      paid: Number(((stats.minutesPaid * stats.rateHour) / 60).toFixed(2)),
    }

    return {
      ...stats,
      ...project,
      ...computed,
      rateHour: Number(project.rateHour ?? stats.rateHour),
    }
  })
}

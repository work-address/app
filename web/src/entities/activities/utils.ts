import type { ITimeTotal, ITimeTotalComputed, ProjectWithStats } from './types'
import type { baseApi } from '@/shared'

export const mapProjectsAndStats = (
  projects: baseApi.Project[] = [],
  stats: ITimeTotal[] = [],
) => {
  const recordStats = stats.reduce(
    (acc, stat) => {
      if (stat?.activityId) {
        acc[stat.activityId] = stat
      }
      return acc
    },
    {} as Record<string, ITimeTotal>,
  )

  return projects.map((project): ProjectWithStats => {
    const stats: ITimeTotal =
      project?.id && recordStats[project.id]
        ? recordStats[project.id]
        : {
            activityId: '',
            rateHour: 0,
            rateTotal: 0,
            minutes: 0,
            keyboardKeys: 0,
            minutesActive: 0,
            mouseDistance: 0,
            mouseKeys: 0,
          }

    const hoursTotal = (stats.minutes - (stats.minutes % 60)) / 60
    const minutesTotal = stats.minutes - hoursTotal * 60
    const hoursActiveTotal =
      (stats.minutesActive - (stats.minutesActive % 60)) / 60
    const minutesActiveTotal = stats.minutesActive - hoursActiveTotal * 60

    const computed: ITimeTotalComputed = {
      hoursTotal,
      minutesTotal,
      minutesActiveTotal,
      hoursActiveTotal,
      earnings: stats.minutes * (stats.rateHour / 60),
    }

    return {
      ...project,
      ...stats,
      ...computed,
    }
  })
}

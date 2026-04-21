import { createQuery } from '@farfetched/core'
import { createEvent, sample, combine } from 'effector'

import { mapProjectsAndStats } from './utils'

import type {
  ProjectWithStats,
  ITimeTotal,
  ITimeTotalDetail,
  ProjectInvoice,
} from './types'

import { baseApi } from '@/features/shared'

const activitiesQuery = createQuery({
  handler: async ({ page = 0 }: { page?: number } = {}) => {
    const response = await baseApi.activityControllerSearchFreelancer({
      body: {
        filter: {},
        page,
        sort: { createdAt: 'DESC' },
      },
    })

    return {
      items: (response.data?.[0] as baseApi.Activity[]) ?? [],
      total: (response.data?.[1] as number) ?? 0,
    }
  },
})

const activitiesStatsQuery = createQuery({
  handler: async (): Promise<ITimeTotal[]> => {
    const response = await baseApi.timeControllerGetTotals()

    return response.data as ITimeTotal[]
  },
})

const fetchActivities = createEvent()

sample({
  clock: fetchActivities,
  target: [activitiesQuery.start, activitiesStatsQuery.start],
})

const $activitiesLoading = combine(
  activitiesQuery.$pending,
  activitiesStatsQuery.$pending,
  (...flags) => flags.some((flag) => flag),
)

const $activities = combine(
  activitiesQuery.$data,
  activitiesStatsQuery.$data,
  (projects, stats): ProjectWithStats[] =>
    mapProjectsAndStats(projects?.items, stats),
)

const activityDetailQuery = createQuery({
  handler: async (id: string) => {
    const response = await baseApi.activityControllerRead({
      path: { id: id as never },
    })

    return response.data as baseApi.Activity
  },
})

const activityReportQuery = createQuery({
  handler: async (id: string) => {
    const response = await baseApi.timeControllerGetReport({
      path: { id: id as never },
    })

    return response.data as { time: ITimeTotalDetail[]; totals: ITimeTotal[] }
  },
})

const fetchInvoice = createEvent<{ id: string }>()

sample({
  clock: fetchInvoice,
  fn: ({ id }) => id,
  target: [activityDetailQuery.start, activityReportQuery.start],
})

const $invoice = combine(
  activityDetailQuery.$data,
  activityReportQuery.$data,
  (detail, report): ProjectInvoice | null => {
    if (!detail) {
      return null
    }

    return {
      ...detail,
      report: report?.totals[0] ?? undefined,
      totalAmount:
        ((report?.totals[0]?.rateHour ?? 0) / 60) *
        (report?.totals[0]?.minutesActive ?? 0),
    }
  },
)

const $invoiceWorklogs = combine(
  activityReportQuery.$data,
  (report): ITimeTotalDetail[] => {
    return report?.time ?? []
  },
)

const $invoiceLoading = combine(
  activityDetailQuery.$pending,
  activityReportQuery.$pending,
  (detailPending, reportPending) => detailPending || reportPending,
)

export {
  $activities,
  $activitiesLoading,
  fetchActivities,
  fetchInvoice,
  $invoice,
  $invoiceWorklogs,
  $invoiceLoading,
}

export {
  type ProjectWithStats,
  type ITimeTotal,
  type ITimeTotalDetail,
} from './types'

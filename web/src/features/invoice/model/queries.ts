import { createQuery } from '@farfetched/core'

import type { ITimeTotal, ITimeTotalDetail } from '@/entities/time'

import { baseApi } from '@/shared'

export const activityDetailQuery = createQuery({
  handler: async (id: string) => {
    const response = await baseApi.projectControllerRead({
      path: { id: id as never },
    })

    return response.data as baseApi.Project
  },
})

export const activityReportQuery = createQuery({
  handler: async (id: string) => {
    const response = await baseApi.timeControllerGetReport({
      path: { id: id as never },
    })

    return response.data as { time: ITimeTotalDetail[]; totals: ITimeTotal[] }
  },
})

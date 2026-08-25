import { createQuery } from '@farfetched/core'

import type { ITimeTotal, ITimeTotalDetail } from '@/entities/time'

import { baseApi, runApiData } from '@/shared'

/**
 * These feed the invoice total. Casting `.data` past a failure used to make a
 * failed request look like an empty report, which computed a $0.00 total
 * rather than showing an error - so failures have to reject here.
 */
export const activityDetailQuery = createQuery({
  handler: (id: string) =>
    runApiData(() =>
      baseApi.projectControllerRead({ path: { id: id as never } }),
    ) as Promise<baseApi.Project>,
})

export const activityReportQuery = createQuery({
  handler: (id: string) =>
    runApiData(() =>
      baseApi.timeControllerGetReport({ path: { id: id as never } }),
    ) as Promise<{ time: ITimeTotalDetail[]; totals: ITimeTotal[] }>,
})

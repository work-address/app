import { createMutation } from '@farfetched/core'

import { baseApi, runApiData } from '@/shared'

/** One mutation instance shared by selected-time actions and invoice routing. */
export const invoiceSelectedTimeMutation = createMutation({
  handler: async (params: { projectId: string; timeIds: string[] }) =>
    runApiData(() =>
      baseApi.invoiceControllerCreate({
        path: { projectId: params.projectId as never },
        body: { timeIds: params.timeIds },
      }),
    ) as Promise<baseApi.InvoiceSearch | null>,
})

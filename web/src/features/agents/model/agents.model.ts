import { concurrency, createQuery } from '@farfetched/core'

import {
  AGENT_RUNS_PAGE,
  agentRunsBody,
  type AgentRun,
  type AgentRunFilters,
} from './agent-runs'

import { baseApi, runApiData } from '@/shared'

export type AgentRunsParams = {
  filters: AgentRunFilters
  /** How many pages to read: More adds one. */
  pages: number
}

/**
 * The runs the filters find, newest first, through the pages asked for. It
 * fails in place: the page says so, with a retry.
 */
export const agentRunsQuery = createQuery({
  handler: async ({ filters, pages }: AgentRunsParams) => {
    const runs: AgentRun[] = []
    let total = 0
    for (let page = 0; page < pages; page += 1) {
      const [items, count] = (await runApiData(
        () =>
          baseApi.agentControllerSearch({
            body: { ...agentRunsBody(filters), offset: page * AGENT_RUNS_PAGE },
          }),
        'in-place',
      )) as [AgentRun[], number]
      runs.push(...items)
      total = count
      if (items.length < AGENT_RUNS_PAGE) {
        break
      }
    }

    return { runs, total }
  },
})

concurrency(agentRunsQuery, { strategy: 'TAKE_LATEST' })

/** One run, by its key: what a link to a run opens when the list does not hold it. */
export const agentRunQuery = createQuery({
  handler: async (runKey: string) => {
    const [items] = (await runApiData(
      () => baseApi.agentControllerSearch({ body: { runKey } }),
      'in-place',
    )) as [AgentRun[], number]

    return items[0] ?? null
  },
})

concurrency(agentRunQuery, { strategy: 'TAKE_LATEST' })

/** The other runs of a run's session, for its detail. */
export const agentSessionRunsQuery = createQuery({
  handler: async (sessionId: string) => {
    const [items] = (await runApiData(
      () => baseApi.agentControllerSearch({ body: { sessionId } }),
      'in-place',
    )) as [AgentRun[], number]

    return items
  },
})

concurrency(agentSessionRunsQuery, { strategy: 'TAKE_LATEST' })

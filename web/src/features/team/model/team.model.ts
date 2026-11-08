import { concurrency, createMutation, createQuery } from '@farfetched/core'
import { combine, createEvent, sample } from 'effector'
import i18n from 'i18next'

import type { OwnAgent, Team } from './types'

import { signOut } from '@/entities/profile'
import { editProjectMutation } from '@/entities/projects'
import {
  baseApi,
  getErrorMessage,
  runApi,
  runApiData,
  showToast,
  suppressGlobalErrorToast,
} from '@/shared'

export const fetchTeam = createEvent()

export const teamQuery = createQuery({
  handler: async () =>
    (await runApiData(() => baseApi.teamControllerRead())) as Team,
})

export const ownAgentsQuery = createQuery({
  handler: async () =>
    (await runApiData(() => baseApi.agentControllerList())) as OwnAgent[],
})

concurrency(teamQuery, { strategy: 'TAKE_LATEST' })
concurrency(ownAgentsQuery, { strategy: 'TAKE_LATEST' })

export const setAgentRateMutation = createMutation({
  handler: async (rate: {
    projectId: string
    agentId: string
    rateHourCents: number
  }) =>
    runApi(() =>
      baseApi.agentControllerAttach({
        path: { id: rate.projectId, agentId: rate.agentId },
        body: { rateHourCents: rate.rateHourCents },
      }),
    ),
})

/** Everyone but a person who is only ever a viewer. True until it is known. */
export const $canSeeTeam = teamQuery.$data.map((team) => !team?.viewerOnly)

export const $teamLoading = combine(
  teamQuery.$data,
  teamQuery.$pending,
  (team, pending) => pending && team === null,
)

sample({ clock: fetchTeam, target: [teamQuery.start, ownAgentsQuery.start] })

sample({
  clock: [
    setAgentRateMutation.finished.success.map(() => void 0),
    editProjectMutation.finished.success.map(() => void 0),
  ],
  target: fetchTeam,
})

sample({
  clock: signOut,
  target: [teamQuery.reset, ownAgentsQuery.reset],
})

// The page says so in place, with a retry; the sidebar asks too, on every page,
// and a toast there would blame a screen the person is not looking at.
teamQuery.finished.failure.watch(({ error }) => {
  suppressGlobalErrorToast(error)
})
ownAgentsQuery.finished.failure.watch(({ error }) => {
  suppressGlobalErrorToast(error)
})

setAgentRateMutation.finished.failure.watch(({ error }) => {
  suppressGlobalErrorToast(error)

  const message = getErrorMessage(error, i18n.t('team.rate.saveError'))

  if (message) {
    showToast('error', { message, position: 'top-center' })
  }
})

setAgentRateMutation.finished.success.watch(() => {
  showToast('success', {
    message: i18n.t('team.rate.saved'),
    position: 'top-center',
  })
})

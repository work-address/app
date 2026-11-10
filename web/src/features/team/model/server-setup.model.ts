import { concurrency, createMutation, createQuery } from '@farfetched/core'
import { attach, combine, createEvent, createStore, sample } from 'effector'

import { agentSlug } from './server-agent'
import { fetchTeam, ownAgentsQuery } from './team.model'

import type {
  AgentCredential,
  OwnAgent,
  ServerAgentForm,
  ServerSetup,
} from './types'

import { signOut } from '@/entities/profile'
import {
  baseApi,
  confirmFx,
  getErrorMessage,
  runApi,
  runApiData,
  showToast,
  showToastFx,
  suppressGlobalErrorToast,
  translate,
} from '@/shared'

/** The form, and the machine identity the dialog made when it opened. */
type SetupRequest = ServerAgentForm & { instanceId: string }
type ConnectRequest = SetupRequest & { agentId: string }

export const serverSetupSubmitted = createEvent<SetupRequest>()
export const serverSetupClosed = createEvent()
export const credentialRevokeRequested = createEvent<{
  id: string
  label: string
}>()

export const credentialsQuery = createQuery({
  handler: async () =>
    (await runApiData(() =>
      baseApi.agentControllerCredentials(),
    )) as AgentCredential[],
})

concurrency(credentialsQuery, { strategy: 'TAKE_LATEST' })

/**
 * The agent, bound to the machine so its runs land on it without the server
 * having to name it.
 */
const createServerAgentMutation = createMutation({
  handler: async ({
    request,
    taken,
  }: {
    request: SetupRequest
    taken: string[]
  }) =>
    (await runApiData(() =>
      baseApi.agentControllerCreate({
        body: {
          name: request.name,
          slug: agentSlug(request.name, request.product, taken),
          product: request.product,
          isDefault: false,
          bindings: [request.instanceId],
        },
      }),
    )) as OwnAgent,
})

/** Attached first: a credential for an agent on no project uploads nothing. */
const connectServerMutation = createMutation({
  handler: async (request: ConnectRequest): Promise<ServerSetup> => {
    await runApi(() =>
      baseApi.agentControllerAttach({
        path: { id: request.projectId, agentId: request.agentId },
        body: { rateHourCents: request.rateHourCents },
      }),
    )

    const issued = (await runApiData(() =>
      baseApi.agentControllerIssue({
        body: {
          instanceId: request.instanceId,
          mode: 'fixed',
          label: request.name,
        },
      }),
    )) as { credential: string; expiresAt: string }

    return {
      product: request.product,
      projectId: request.projectId,
      instanceId: request.instanceId,
      credential: issued.credential,
      expiresAt: issued.expiresAt,
    }
  },
})

const revokeCredentialMutation = createMutation({
  handler: async (id: string) =>
    runApi(() => baseApi.agentControllerRevoke({ path: { id } })),
})

/**
 * The agent a failed setup already made. Sending the form again carries on
 * from it instead of making a second one, under the name and runtime it was
 * made with: those are settled, whatever the form says by then.
 */
const $createdAgent = createStore<Pick<
  ConnectRequest,
  'agentId' | 'name' | 'product'
> | null>(null)
  .on(createServerAgentMutation.finished.success, (_, { params, result }) => ({
    agentId: result.id,
    name: params.request.name,
    product: params.request.product,
  }))
  .reset(serverSetupClosed, signOut)

/** The dialog locks the fields that can no longer change. */
export const $serverSetupResuming = $createdAgent.map(
  (created) => created !== null,
)

/** Held only while the dialog shows it: the API never returns the secret again. */
export const $serverSetup = createStore<ServerSetup | null>(null)
  .on(connectServerMutation.finished.success, (_, { result }) => result)
  .reset(serverSetupClosed, signOut)

export const $serverSetupPending = combine(
  createServerAgentMutation.$pending,
  connectServerMutation.$pending,
  (creating, connecting) => creating || connecting,
)

export const $credentialRevoking = revokeCredentialMutation.$pending

sample({
  clock: serverSetupSubmitted,
  source: { created: $createdAgent, agents: ownAgentsQuery.$data },
  filter: ({ created }) => created === null,
  fn: ({ agents }, request) => ({
    request,
    taken: (agents ?? []).map((agent) => agent.slug),
  }),
  target: createServerAgentMutation.start,
})

sample({
  clock: serverSetupSubmitted,
  source: $createdAgent,
  filter: (created) => created !== null,
  fn: (created, request) => ({ ...request, ...created! }),
  target: connectServerMutation.start,
})

sample({
  clock: createServerAgentMutation.finished.success,
  fn: ({ params, result }) => ({ ...params.request, agentId: result.id }),
  target: connectServerMutation.start,
})

const confirmRevokeFx = attach({
  effect: confirmFx,
  mapParams: ({ label }: { id: string; label: string }) => ({
    title: translate('team.servers.revoke.title'),
    description: translate('team.servers.revoke.description', { label }),
    confirmLabel: translate('team.servers.revoke.confirm'),
    cancelLabel: translate('common.cancel'),
  }),
})

sample({ clock: credentialRevokeRequested, target: confirmRevokeFx })

sample({
  clock: confirmRevokeFx.done,
  fn: ({ params }) => params.id,
  target: revokeCredentialMutation.start,
})

sample({ clock: fetchTeam, target: credentialsQuery.start })

// An agent made by a setup that then failed is on the page all the same.
sample({
  clock: [
    createServerAgentMutation.finished.success.map(() => void 0),
    connectServerMutation.finished.success.map(() => void 0),
    revokeCredentialMutation.finished.success.map(() => void 0),
  ],
  target: fetchTeam,
})

sample({ clock: signOut, target: credentialsQuery.reset })

// The servers list is left out when it cannot load; the agents above still show.
credentialsQuery.finished.failure.watch(({ error }) => {
  suppressGlobalErrorToast(error)
})

const setupFailed = ({ error }: { error: unknown }) => {
  suppressGlobalErrorToast(error)

  const message = getErrorMessage(error, translate('team.serverSetup.failed'))

  if (message) {
    showToast('error', { message, position: 'top-center' })
  }
}

createServerAgentMutation.finished.failure.watch(setupFailed)
connectServerMutation.finished.failure.watch(setupFailed)

sample({
  clock: revokeCredentialMutation.finished.success,
  fn: () => ({
    type: 'success' as const,
    messageKey: 'team.servers.revoke.success',
  }),
  target: showToastFx,
})

sample({
  clock: revokeCredentialMutation.finished.failure,
  fn: () => ({
    type: 'error' as const,
    messageKey: 'team.servers.revoke.failed',
  }),
  target: showToastFx,
})

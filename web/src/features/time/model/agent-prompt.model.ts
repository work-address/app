import { attach, createEvent, sample } from 'effector'

import type { TimeAgentRun } from '@/entities/time'

import { removeAgentPromptMutation } from '@/entities/time'
import { confirmFx, showToastFx, translate } from '@/shared'

/**
 * Whether this reader may erase a run's prompt: their own run, until it is on
 * an invoice, when the prompt becomes part of what the owner is asked to pay.
 */
export const canRemoveAgentPrompt = (
  run: Pick<TimeAgentRun, 'prompt' | 'userId' | 'invoiceId'>,
  userId: string | undefined,
) => Boolean(run.prompt) && run.userId === userId && !run.invoiceId

export const agentPromptRemoveRequested = createEvent<string>()

const confirmRemoveFx = attach({
  effect: confirmFx,
  mapParams: (_runKey: string) => ({
    title: translate('dashboard.prompts.remove.title'),
    description: translate('dashboard.prompts.remove.description'),
    confirmLabel: translate('dashboard.prompts.remove.confirm'),
    cancelLabel: translate('common.cancel'),
  }),
})

sample({ clock: agentPromptRemoveRequested, target: confirmRemoveFx })

sample({
  clock: confirmRemoveFx.done,
  fn: ({ params }) => params,
  target: removeAgentPromptMutation.start,
})

sample({
  clock: removeAgentPromptMutation.finished.success,
  fn: () => ({
    type: 'success' as const,
    messageKey: 'dashboard.prompts.remove.success',
  }),
  target: showToastFx,
})

sample({
  clock: removeAgentPromptMutation.finished.failure,
  fn: () => ({
    type: 'error' as const,
    messageKey: 'dashboard.prompts.remove.failed',
  }),
  target: showToastFx,
})

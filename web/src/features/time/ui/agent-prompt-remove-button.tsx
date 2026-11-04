import { TrashIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { agentPromptRemoveRequested } from '../model/agent-prompt.model'

import { IconButton, Tooltip } from '@/shared'

type Props = {
  runKey: string
  className?: string
}

/**
 * Always visible rather than revealed on hover, which a touch screen does not
 * have. Callers show it only where `canRemoveAgentPrompt` allows.
 */
export const AgentPromptRemoveButton = ({ runKey, className }: Props) => {
  const { t } = useTranslation()
  const requestRemove = useUnit(agentPromptRemoveRequested)
  const label = t('dashboard.prompts.remove.action')

  return (
    <Tooltip content={label}>
      <IconButton
        className={className}
        variant="ghost"
        color="gray"
        size="1"
        aria-label={label}
        onClick={() => requestRemove(runKey)}
      >
        <TrashIcon width={14} height={14} aria-hidden="true" />
      </IconButton>
    </Tooltip>
  )
}

import { PlusIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $serverSetup,
  $serverSetupPending,
  $serverSetupResuming,
  ownAgentsQuery,
  serverSetupClosed,
  serverSetupSubmitted,
  type TeamProjectData,
} from '../../model'

import { TeamServerSetupForm } from './team-server-setup-form'
import { TeamServerSetupResult } from './team-server-setup-result'

import { AdaptiveDialog, Button, DIALOG_WIDTH_STANDARD } from '@/shared'

const FORM_ID = 'team-server-setup-form'

type Props = {
  /** The reader's projects on the Team page: an agent is attached to one. */
  projects: TeamProjectData[]
}

/**
 * Sets up an agent that runs on a server: makes the agent, attaches it to a
 * project, and issues the credential its collector uploads with. The laptop
 * app needs none of this; it registers its agents by recording.
 */
export const TeamServerSetup = ({ projects }: Props) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // The machine's identity. The agent is bound to it and the credential is
  // issued for it, so one dialog keeps one, whatever is retried.
  const [instanceId, setInstanceId] = useState('')
  const { setup, pending, resuming, agents, submit, close } = useUnit({
    setup: $serverSetup,
    pending: $serverSetupPending,
    resuming: $serverSetupResuming,
    agents: ownAgentsQuery.$data,
    submit: serverSetupSubmitted,
    close: serverSetupClosed,
  })

  const setOpenTo = (next: boolean) => {
    if (next) {
      setInstanceId(crypto.randomUUID())
    } else {
      close()
    }
    setOpen(next)
  }

  return (
    <>
      <Button
        size="s"
        variant="soft"
        color="neutral"
        iconLeft={<PlusIcon />}
        onClick={() => setOpenTo(true)}
      >
        {t('team.serverSetup.open')}
      </Button>
      <AdaptiveDialog
        title={t(
          setup ? 'team.serverSetup.resultTitle' : 'team.serverSetup.title',
        )}
        open={open}
        onOpenChange={setOpenTo}
        desktopWidth={DIALOG_WIDTH_STANDARD}
        footer={
          <Footer>
            {setup ? (
              <Button onClick={() => setOpenTo(false)}>
                {t('team.serverSetup.done')}
              </Button>
            ) : (
              <>
                <Button
                  variant="soft"
                  color="neutral"
                  disabled={pending}
                  onClick={() => setOpenTo(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" form={FORM_ID} disabled={pending}>
                  {t('team.serverSetup.submit')}
                </Button>
              </>
            )}
          </Footer>
        }
      >
        {setup ? (
          <TeamServerSetupResult setup={setup} />
        ) : (
          <TeamServerSetupForm
            id={FORM_ID}
            projects={projects}
            agents={agents ?? []}
            disabled={pending}
            agentSettled={resuming}
            onSubmit={(form) => submit({ ...form, instanceId })}
          />
        )}
      </AdaptiveDialog>
    </>
  )
}

const Footer = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: end;
  gap: var(--ui-space-2);
`

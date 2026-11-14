import { CopyIcon, ExternalLinkIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  eventsEndpoint,
  installCommand,
  SERVER_PRODUCT_NAMES,
  setupCommand,
  setupGuideUrl,
  type ServerSetup,
} from '../../model'

import {
  Button,
  copyToClipboard,
  DEMO_MODE,
  showToast,
  workspaceStatusStyles,
} from '@/shared'

type Props = {
  setup: ServerSetup
}

type CopyProps = {
  text: string
  action: string
  copied: string
}

/** Something to carry to the server by hand, with a button that copies it. */
const Copyable = ({ text, action, copied }: CopyProps) => {
  const copy = () => {
    copyToClipboard(text)
      .then(() =>
        showToast('info', { message: copied, position: 'top-center' }),
      )
      .catch(() => {})
  }

  return (
    <>
      <Code>{text}</Code>
      <Actions>
        <Button
          size="s"
          variant="outline"
          color="neutral"
          iconLeft={<CopyIcon />}
          onClick={copy}
        >
          {action}
        </Button>
      </Actions>
    </>
  )
}

/**
 * What to do on the server, with the credential. This is the only time the
 * credential exists outside the server it is pasted into. It is copied before
 * the command is run, because the command waits 30 seconds for it.
 */
export const TeamServerSetupResult = ({ setup }: Props) => {
  const { t } = useTranslation()
  const product = SERVER_PRODUCT_NAMES[setup.product]
  const command = setupCommand({
    endpoint: eventsEndpoint(
      import.meta.env.VITE_API_URL,
      window.location.origin,
    ),
    projectId: setup.projectId,
    instanceId: setup.instanceId,
  })

  return (
    <Root>
      <Warning role="note" data-tone="attention">
        {t(DEMO_MODE ? 'team.serverSetup.demo' : 'team.serverSetup.shownOnce')}
      </Warning>
      <List>
        <Item>
          <Step>
            <Label>{t('team.serverSetup.step.install', { product })}</Label>
            <Copyable
              text={installCommand(setup.product)}
              action={t('team.serverSetup.copyInstall')}
              copied={t('team.serverSetup.installCopied')}
            />
            <Guide
              href={setupGuideUrl(setup.product)}
              target="_blank"
              rel="noreferrer"
            >
              {t('team.serverSetup.guide', { product })}
              <ExternalLinkIcon aria-hidden />
            </Guide>
          </Step>
        </Item>
        <Item>
          <Step>
            <Label>{t('team.serverSetup.step.credential')}</Label>
            <Copyable
              text={setup.credential}
              action={t('team.serverSetup.copyCredential')}
              copied={t('team.serverSetup.credentialCopied')}
            />
          </Step>
        </Item>
        <Item>
          <Step>
            <Label>{t('team.serverSetup.step.command')}</Label>
            <Copyable
              text={command}
              action={t('team.serverSetup.copyCommand')}
              copied={t('team.serverSetup.commandCopied')}
            />
          </Step>
        </Item>
        <Item>
          <Label>{t('team.serverSetup.step.connect', { product })}</Label>
        </Item>
      </List>
      <Hint>
        {t('team.serverSetup.expires', {
          date: new Date(setup.expiresAt).toLocaleDateString(),
        })}
      </Hint>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--ui-space-4);
`

/* The attention status, as a paragraph rather than a one-line pill. */
const Warning = styled.p`
  ${workspaceStatusStyles}

  display: block;
  margin: 0;
  padding-block: var(--ui-space-2);
  border-radius: var(--ui-row-radius);
  font-weight: var(--ui-weight-regular);
  white-space: normal;
`

const List = styled.ol`
  display: grid;
  gap: var(--ui-space-4);
  margin: 0;
  padding: 0 0 0 var(--ui-space-5);
  /* The app's reset takes list markers away; these steps are in order. */
  list-style: decimal;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
`

const Item = styled.li``

/* A list item lays out its own marker, so its parts stack in a grid inside. */
const Step = styled.div`
  display: grid;
  gap: var(--ui-space-2);
`

const Label = styled.span`
  line-height: var(--ui-body-line-height);
`

const Guide = styled.a`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  justify-self: start;
  gap: var(--ui-space-1);
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
`

const Code = styled.code`
  display: block;
  white-space: pre-wrap;
  padding: var(--ui-space-3);
  border: var(--ui-border-width) solid var(--ui-line);
  border-radius: var(--ui-row-radius);
  background: var(--ui-inset);
  font-family: var(--ui-font-mono);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
  user-select: all;
`

const Actions = styled.div`
  display: grid;
  justify-content: start;
`

const Hint = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $identityAction,
  $identityConfig,
  $identityPreview,
  $identityView,
  $identityViewState,
  IDENTITY_ACTION_MESSAGE_KEY,
  IDENTITY_ACTION_TONE,
  IDENTITY_VIEW_MESSAGE_KEY,
  identityCardMounted,
  isIdentityPublishable,
  removeIdentityFx,
} from '../../model'

import { IdentityCardActions } from './identity-card-actions'
import { IdentityCardExportDialog } from './identity-card-export-dialog'
import { IdentityCardHistory } from './identity-card-history'
import { IdentityCardPreview } from './identity-card-preview'
import {
  IdentityCardWalletDialog,
  type IdentityWalletAction,
} from './identity-card-wallet-dialog'

import { Card, Checkbox, Text, type CardProps } from '@/shared'

const ACKNOWLEDGE_ID = 'identity-permanence-acknowledge'

/**
 * Portable identity on the profile form: what the commitment will cover, the
 * one thing a holder cannot undo, the two transactions their own wallet
 * sends, the private export and the registry's own history.
 *
 * Publishing is gated on the acknowledgement rather than explained after the
 * fact: the chain keeps every version forever, so the sentence has to be read
 * before the button works, not afterwards.
 */
export const IdentityCard = () => {
  const { t } = useTranslation()
  const [acknowledged, setAcknowledged] = useState(false)
  const [walletAction, setWalletAction] = useState<IdentityWalletAction | null>(
    null,
  )
  const [exportOpen, setExportOpen] = useState(false)

  const { config, state, view, preview, action, remove, removing, mounted } =
    useUnit({
      config: $identityConfig,
      state: $identityViewState,
      view: $identityView,
      preview: $identityPreview,
      action: $identityAction,
      remove: removeIdentityFx,
      removing: removeIdentityFx.pending,
      mounted: identityCardMounted,
    })

  useEffect(() => {
    mounted()
  }, [mounted])

  // Nothing to anchor to, and nothing a holder could do about it here.
  if (config !== null && state === 'unconfigured') {
    return null
  }

  const publishable = isIdentityPublishable(preview)
  const hosted = view !== null

  return (
    <Root shadow={false}>
      <Header>
        <Text size={{ initial: '4', md: '6' }} weight="medium">
          {t('identity.card.title')}
        </Text>
        <Text size="2" color="gray">
          {t('identity.card.description')}
        </Text>
      </Header>
      <State data-state={state} aria-live="polite">
        <Text size="2">
          {t(IDENTITY_VIEW_MESSAGE_KEY[state])}
          {hosted ? ` (v${view.version})` : ''}
        </Text>
      </State>
      {action !== null && (
        <Outcome data-tone={IDENTITY_ACTION_TONE[action]} role="status">
          <Text size="2">{t(IDENTITY_ACTION_MESSAGE_KEY[action])}</Text>
        </Outcome>
      )}
      {state !== 'unanchorable' && (
        <>
          <IdentityCardPreview preview={preview} />
          <Permanence>
            <Text size="3" weight="medium">
              {t('identity.permanence.title')}
            </Text>
            <Text size="2" color="gray">
              {t('identity.permanence.body')}
            </Text>
            <Text size="2" color="gray">
              {t('identity.card.custody')}
            </Text>
            <Option>
              <Checkbox
                id={ACKNOWLEDGE_ID}
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <Text as="label" htmlFor={ACKNOWLEDGE_ID} size="2">
                {t('identity.permanence.acknowledge')}
              </Text>
            </Option>
          </Permanence>
          <IdentityCardActions
            hosted={hosted}
            publishable={publishable}
            acknowledged={acknowledged}
            removing={removing}
            onPublish={() => setWalletAction('publish')}
            onWithdraw={() => setWalletAction('withdraw')}
            onRemove={() => {
              void remove()
            }}
            onExport={() => setExportOpen(true)}
          />
          {hosted && <IdentityCardHistory history={view.history} />}
        </>
      )}
      <IdentityCardWalletDialog
        action={walletAction}
        onOpenChange={(open) => setWalletAction(open ? walletAction : null)}
      />
      <IdentityCardExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
    </Root>
  )
}

/* Set like the other sections of the profile form: same rule on top, same
   heading size, so it reads as one more section rather than a block appended
   to the page. */
const Root = styled(Card)<CardProps>`
  display: grid;
  gap: var(--space-4);
  box-shadow: none;

  ${(p) => p.theme.breakpoints.down('md')} {
    border: none;
    border-top: 1px solid var(--ds-neutral-alpha-6);

    &[data-shadow] {
      box-shadow: none;
    }
  }
`

const Header = styled.div`
  display: grid;
  gap: var(--space-2);
`

const State = styled.div`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
  overflow-wrap: anywhere;

  &[data-state='current'] {
    background: var(--ds-accent-2);
  }

  &[data-state='withdrawn'],
  &[data-state='superseded'],
  &[data-state='mismatch'] {
    background: var(--ds-amber-2);
  }
`

const Outcome = styled.div`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
  overflow-wrap: anywhere;

  &[data-tone='success'] {
    background: var(--ds-accent-2);
  }

  &[data-tone='error'] {
    background: var(--ds-amber-2);
  }
`

const Permanence = styled.div`
  display: grid;
  gap: var(--space-2);
`

const Option = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-2);
`

import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $identityExport,
  identityExportDismissed,
  loadIdentityExportFx,
} from '../../model'

import {
  AdaptiveDialog,
  Button,
  DIALOG_WIDTH_WIDE,
  Text,
  copyToClipboard,
  showToast,
} from '@/shared'
import { serializeDocument } from '@/shared/vendor/identity'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The private export: every field's value with its salt. It is fetched only
 * when the holder asks for it, shown as the canonical document the library
 * would read back, and never written anywhere by the app - copying it is the
 * holder's own step, as with the wallet's private key.
 */
export const IdentityCardExportDialog = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation()

  const { document, load, pending, dismiss } = useUnit({
    document: $identityExport,
    load: loadIdentityExportFx,
    pending: loadIdentityExportFx.pending,
    dismiss: identityExportDismissed,
  })

  // The document holds every field's salt, so it is dropped the moment the
  // holder is done looking at it - when the dialog closes by any route, and
  // when the card unmounts with it still open.
  useEffect(() => {
    if (!open) {
      return
    }

    return () => dismiss()
  }, [open, dismiss])

  const text = document ? serializeDocument(document) : ''

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('identity.export.title')}
      desktopWidth={DIALOG_WIDTH_WIDE}
      desktopShowClose
    >
      <Body>
        <Text size="2" color="amber">
          {t('identity.export.hint')}
        </Text>
        {text === '' ? (
          <Button
            loading={pending}
            disabled={pending}
            onClick={() => {
              void load()
            }}
          >
            {t('identity.actions.export')}
          </Button>
        ) : (
          <>
            <Document>{text}</Document>
            <Actions>
              <Button
                variant="outline"
                color="neutral"
                onClick={() => {
                  void copyToClipboard(text).then(() => {
                    showToast('info', {
                      message: t('identity.export.title'),
                      position: 'top-center',
                    })
                  })
                }}
              >
                {t('localWallet.export.copy')}
              </Button>
              <Button
                color="neutral"
                variant="soft"
                onClick={() => onOpenChange(false)}
              >
                {t('common.close')}
              </Button>
            </Actions>
          </>
        )}
      </Body>
    </AdaptiveDialog>
  )
}

const Body = styled.div`
  display: grid;
  gap: var(--space-4);
`

const Document = styled.pre`
  margin: 0;
  max-height: 40vh;
  overflow: auto;
  padding: var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
  font-size: 12px;
  /* The document is one long line of canonical JSON; without this it makes
     the dialog - and the page behind it - scroll sideways on a phone. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: end;
  gap: var(--space-3);
`

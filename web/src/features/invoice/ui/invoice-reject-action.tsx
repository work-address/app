import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $invoiceCanReject,
  invoiceRejectionRequested,
  rejectInvoiceMutation,
} from '../model/rejection.model'

import type { ComponentType, ReactNode } from 'react'

import {
  AdaptiveDialog,
  Button,
  DIALOG_WIDTH_STANDARD,
  Text,
  TextArea,
} from '@/shared'

type Props = {
  /** What the button sits in, so the bar can give it a row of its own. */
  Slot: ComponentType<{ children: ReactNode }>
  stretch?: boolean
}

/**
 * Rejecting is the rare path, so it is a button beside the invoice's other
 * actions and asks for its reason in a dialog, rather than a form open on every
 * invoice awaiting payment. A success re-reads the invoice, `$invoiceCanReject`
 * turns false and this leaves the page, dialog and all.
 */
export const InvoiceRejectAction = ({ Slot, stretch }: Props) => {
  const { t } = useTranslation()
  const { canReject, reject, pending, failed } = useUnit({
    canReject: $invoiceCanReject,
    reject: invoiceRejectionRequested,
    pending: rejectInvoiceMutation.$pending,
    failed: rejectInvoiceMutation.$failed,
  })
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!canReject) {
    return null
  }

  return (
    <Slot>
      <Button
        variant="outline"
        color="neutral"
        stretch={stretch}
        onClick={() => setOpen(true)}
      >
        {t('invoice.reject.action')}
      </Button>
      <AdaptiveDialog
        open={open}
        onOpenChange={setOpen}
        title={t('invoice.reject.action')}
        desktopWidth={DIALOG_WIDTH_STANDARD}
        desktopShowClose
      >
        <Form
          onSubmit={(event) => {
            event.preventDefault()
            reject(reason)
          }}
        >
          <TextArea
            label={t('invoice.reject.reasonLabel')}
            value={reason}
            maxLength={500}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
          />
          <Text size="2" color="gray">
            {t('invoice.reject.notice')}
          </Text>
          {failed && (
            <Text size="2" color="red" role="alert">
              {t('invoice.reject.failed')}
            </Text>
          )}
          <Actions>
            <Button
              type="button"
              variant="soft"
              color="neutral"
              onClick={() => setOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {t('invoice.reject.action')}
            </Button>
          </Actions>
        </Form>
      </AdaptiveDialog>
    </Slot>
  )
}

const Form = styled.form`
  display: grid;
  gap: var(--space-3);
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: end;
  gap: var(--space-2);
`

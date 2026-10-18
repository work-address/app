import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $invoiceCanReject,
  invoiceRejectionRequested,
  rejectInvoiceMutation,
} from '../model/rejection.model'
import { $invoice } from '../model/stores'

import { Button, formatCurrency, Text } from '@/shared'

/** The charged snapshot is also the printable breakdown. */
export const InvoiceLines = () => {
  const { t } = useTranslation()
  const { invoice, canReject, reject, pending, failed } = useUnit({
    invoice: $invoice,
    canReject: $invoiceCanReject,
    reject: invoiceRejectionRequested,
    pending: rejectInvoiceMutation.$pending,
    failed: rejectInvoiceMutation.$failed,
  })
  const [reason, setReason] = useState('')
  if (!invoice) {
    return null
  }
  return (
    <Root>
      {invoice.state === 'REJECTED' && (
        <Text role="status">
          {t('Rejected')}
          {invoice.rejectionReason ? `: ${invoice.rejectionReason}` : ''}
        </Text>
      )}
      <TableWrap>
        <Table>
          <caption>{t('Billed time')}</caption>
          <thead>
            <tr>
              <th>{t('Work')}</th>
              <th>{t('Hours')}</th>
              <th>{t('Rate per hour')}</th>
              <th>{t('Amount')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines?.map((line, index) => (
              <tr key={line.agentId ?? index}>
                <td>
                  {line.name}
                  <Detail>
                    {line.kind === 'human' && line.basis === 'active'
                      ? t('Priced on active time (legacy invoice)')
                      : line.kind === 'human'
                        ? t('All tracked minutes')
                        : t('Agent time')}
                    {Boolean(line.manualMinutes) &&
                      ` · ${t('Manual')}: ${(line.manualMinutes! / 60).toFixed(2)} h`}
                    {line.kind === 'agent' &&
                      ` · ${t('Assisted')}: ${((line.assistedMinutes ?? 0) / 60).toFixed(2)} h`}
                  </Detail>
                </td>
                <td>{(line.minutes / 60).toFixed(2)}</td>
                <td>
                  {line.rateHourCents == null
                    ? '—'
                    : formatCurrency(line.rateHourCents / 100)}
                </td>
                <td>{formatCurrency(line.amountCents / 100)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {canReject && (
        <RejectForm
          onSubmit={(event) => {
            event.preventDefault()
            reject(reason)
          }}
        >
          <label>
            {t('Reason for rejection (optional)')}
            <Reason
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Text size="2">
            {t(
              'Rejecting keeps this invoice as a record and releases its entries so the issuer can correct and reissue it.',
            )}
          </Text>
          <Button type="submit" variant="outline" loading={pending}>
            {t('Reject invoice')}
          </Button>
          {failed && (
            <Text role="alert">
              {t('The invoice could not be rejected. Refresh and try again.')}
            </Text>
          )}
        </RejectForm>
      )}
    </Root>
  )
}
const Root = styled.section`
  display: grid;
  gap: var(--space-3);
  min-width: 0;
`
const TableWrap = styled.div`
  overflow-x: auto;
`
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  caption {
    text-align: left;
    font-weight: 600;
    padding-bottom: var(--space-3);
  }
  th,
  td {
    padding: var(--space-3);
    text-align: right;
    border-bottom: 1px solid var(--gray-5);
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  td {
    vertical-align: top;
  }
`
const Detail = styled.div`
  font-size: 12px;
  color: var(--gray-11);
`
const RejectForm = styled.form`
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  @media print {
    display: none;
  }
`
const Reason = styled.textarea`
  display: block;
  width: min(420px, 70vw);
  min-height: 70px;
`

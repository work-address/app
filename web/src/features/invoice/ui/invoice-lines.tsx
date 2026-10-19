import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { invoiceStateLabelKey } from '../lib'
import { formatCents } from '../model/format'
import {
  $invoiceCanReject,
  invoiceRejectionRequested,
  rejectInvoiceMutation,
} from '../model/rejection.model'
import { $invoice } from '../model/stores'

import {
  Button,
  formatDurationFromMinutes,
  Text,
  useDateFormatter,
} from '@/shared'

type InvoiceLine = NonNullable<
  NonNullable<ReturnType<typeof $invoice.getState>>['lines']
>[number]

/** The charged snapshot is also the printable breakdown. */
export const InvoiceLines = () => {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()
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
  const hours = (minutes: number | undefined) =>
    formatDurationFromMinutes(minutes ?? 0, t)
  // Every part of a line the plan asks the invoice to say: how the human line
  // was priced, and for an agent line how much was assisted, waiting for a
  // person, unclassified or manual - and when its rate changed mid-period.
  const details = (line: InvoiceLine): string[] => {
    const parts = [
      t(
        line.kind === 'agent'
          ? 'invoice.lines.basis.agent'
          : line.basis === 'active'
            ? 'invoice.lines.basis.active'
            : 'invoice.lines.basis.tracked',
      ),
    ]
    if (line.kind === 'agent') {
      parts.push(
        `${t('invoice.lines.assisted')}: ${hours(line.assistedMinutes)}`,
      )
      if (line.waitMinutes) {
        parts.push(`${t('invoice.lines.waiting')}: ${hours(line.waitMinutes)}`)
      }
      if (line.unclassifiedMinutes) {
        parts.push(
          `${t('invoice.lines.unclassified')}: ${hours(line.unclassifiedMinutes)}`,
        )
      }
    }
    if (line.manualMinutes) {
      parts.push(`${t('invoice.lines.manual')}: ${hours(line.manualMinutes)}`)
    }
    return parts
  }
  return (
    <Root>
      {invoice.state === 'REJECTED' && (
        <Text role="status">
          {t(invoiceStateLabelKey(invoice))}
          {invoice.rejectionReason ? `: ${invoice.rejectionReason}` : ''}
        </Text>
      )}
      <TableWrap>
        <Table>
          <caption>{t('invoice.lines.heading')}</caption>
          <thead>
            <tr>
              <th>{t('invoice.lines.work')}</th>
              <th>{t('invoice.lines.hours')}</th>
              <th>{t('invoice.lines.rate')}</th>
              <th>{t('invoice.lines.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines?.map((line, index) => (
              <tr key={line.agentId ?? index}>
                <td>
                  {line.name}
                  <Detail>{details(line).join(' · ')}</Detail>
                  {line.rateChanges?.map((change, position) =>
                    change.at && change.fromCents != null ? (
                      <Detail key={position}>
                        {t('invoice.lines.rateChanged', {
                          date: dateFormatter.format(new Date(change.at)),
                          before: hours(change.minutesBefore),
                          from: formatCents(change.fromCents),
                        })}
                      </Detail>
                    ) : null,
                  )}
                </td>
                <td>{hours(line.minutes)}</td>
                <td>
                  {line.rateHourCents == null
                    ? '—'
                    : formatCents(line.rateHourCents)}
                </td>
                <td>{formatCents(line.amountCents)}</td>
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
            {t('invoice.reject.reasonLabel')}
            <Reason
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Text size="2">{t('invoice.reject.notice')}</Text>
          <Button type="submit" variant="outline" loading={pending}>
            {t('invoice.reject.action')}
          </Button>
          {failed && <Text role="alert">{t('invoice.reject.failed')}</Text>}
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

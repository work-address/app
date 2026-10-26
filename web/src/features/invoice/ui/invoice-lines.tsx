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
  SectionTitle,
  Text,
  TextArea,
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
          {/* The table's own caption, set like the page's other section
              titles, so "Billed time" and "Worklogs" match. */}
          <Caption as="caption">{t('invoice.lines.heading')}</Caption>
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
          <Button type="submit" variant="outline" loading={pending}>
            {t('invoice.reject.action')}
          </Button>
          {failed && (
            <Text size="2" color="red" role="alert">
              {t('invoice.reject.failed')}
            </Text>
          )}
        </RejectForm>
      )}
    </Root>
  )
}
const Root = styled.section`
  display: grid;
  gap: var(--space-4);
  min-width: 0;
`

const TableWrap = styled.div`
  overflow-x: auto;
`

const Caption = styled(SectionTitle)`
  text-align: left;
  padding-bottom: var(--space-4);
`

/* Set like DataTable: a bold, dark header over hairline rows. */
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);

  th,
  td {
    padding: var(--space-3);
    text-align: right;
    border-bottom: 1px solid var(--ds-neutral-alpha-6);
  }

  th {
    font-weight: 600;
    color: var(--ds-neutral-12);
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }

  td {
    vertical-align: top;
  }

  /* Figures never break; the work column gives way instead. */
  td:not(:first-child) {
    white-space: nowrap;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    th,
    td {
      padding: var(--space-2) var(--space-1);
    }
  }
`

const Detail = styled.div`
  font-size: var(--font-size-1);
  line-height: var(--line-height-1);
  color: var(--ds-neutral-11);
`

/* The field fills the form; only the button keeps to its own width. */
const RejectForm = styled.form`
  display: grid;
  gap: var(--space-2);
  width: min(480px, 100%);

  & > button {
    justify-self: start;
  }

  @media print {
    display: none;
  }
`

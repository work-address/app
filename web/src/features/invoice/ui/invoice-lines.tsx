import { useUnit } from 'effector-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { invoiceStateLabelKey } from '../lib'
import { formatCents } from '../model/format'
import { $invoice } from '../model/stores'

import { InvoiceSection } from './invoice-section'

import { formatDurationFromMinutes, Text, useDateFormatter } from '@/shared'

type InvoiceLine = NonNullable<
  NonNullable<ReturnType<typeof $invoice.getState>>['lines']
>[number]

/** The charged snapshot is also the printable breakdown. */
export const InvoiceLines = () => {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()
  const invoice = useUnit($invoice)
  const titleId = useId()
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
      {/* The badge already says it was rejected; this says why, if anyone did. */}
      {invoice.state === 'REJECTED' && invoice.rejectionReason && (
        <Rejection role="status" size="2">
          {t(invoiceStateLabelKey(invoice))}: {invoice.rejectionReason}
        </Rejection>
      )}
      <InvoiceSection title={t('invoice.lines.heading')} titleId={titleId}>
        <TableWrap>
          <Table aria-labelledby={titleId}>
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
      </InvoiceSection>
    </Root>
  )
}
const Root = styled.section`
  display: grid;
  gap: var(--space-4);
  min-width: 0;
`

const Rejection = styled(Text)`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-3);
  background: var(--red-a3);
  color: var(--red-11);
  overflow-wrap: anywhere;
`

const TableWrap = styled.div`
  overflow-x: auto;
`

/* Set like DataTable: a medium, dark header over hairline rows. */
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
    font-weight: 500;
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

  tbody tr:last-child td {
    border-bottom: 0;
  }

  /* The outer cells keep to the card's inset, level with the title above. */
  @media screen {
    th:first-child,
    td:first-child {
      padding-left: var(--space-5);
    }

    th:last-child,
    td:last-child {
      padding-right: var(--space-5);
    }
  }

  /* Four columns squeeze the work to a word a line on a phone, so it takes a
     row of its own over the three figures. On screen only: paper is wide. */
  @media screen {
    ${(p) => p.theme.breakpoints.down('md')} {
      thead tr,
      tbody tr {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        border-bottom: 1px solid var(--ds-neutral-alpha-6);
      }

      && th,
      && td {
        padding: var(--space-2) 0;
        border-bottom: 0;
      }

      th:first-child {
        display: none;
      }

      && td:first-child {
        grid-column: 1 / -1;
        padding-bottom: 0;
      }

      th:nth-child(2),
      td:nth-child(2) {
        text-align: left;
      }
    }
  }
`

const Detail = styled.div`
  font-size: var(--font-size-1);
  line-height: var(--line-height-1);
  color: var(--ds-neutral-11);
`

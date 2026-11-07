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
  gap: var(--ui-space-4);
  min-width: 0;

  /* The bill stays whole on one page, its heading with it. */
  @media print {
    display: block;
    break-inside: avoid;
  }
`

const Rejection = styled(Text)`
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-filter-radius);
  background: var(--red-a3);
  color: var(--red-11);
  overflow-wrap: anywhere;

  @media print {
    display: block;
    margin-bottom: var(--ui-space-3);
  }
`

const TableWrap = styled.div`
  overflow-x: auto;

  @media print {
    overflow: visible;
  }
`

/* Set like DataTable: a medium, dark header over hairline rows. */
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);

  th,
  td {
    padding: var(--ui-space-3);
    text-align: right;
    border-bottom: 1px solid var(--ui-line);
  }

  th {
    font-weight: 500;
    color: var(--ui-ink);
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

  /* The outer cells reach the page's edge, level with the title above. */
  @media screen {
    th:first-child,
    td:first-child {
      padding-left: 0;
    }

    th:last-child,
    td:last-child {
      padding-right: 0;
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
        border-bottom: 1px solid var(--ui-line);
      }

      /* The next section's rule closes the table. */
      tbody tr:last-child {
        border-bottom: 0;
      }

      && th,
      && td {
        padding: var(--ui-space-2) 0;
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

  /* Set like the worklogs under it, flush with the headings on the left and
     the paper's margin on the right. */
  @media print {
    th,
    td {
      padding: var(--ui-space-1) var(--ui-space-2);
      border-bottom: 1px solid var(--ui-inset);
    }

    th {
      border-bottom: 1px solid var(--ui-muted);
    }

    th:first-child,
    td:first-child {
      padding-left: 0;
    }

    th:last-child,
    td:last-child {
      padding-right: 0;
    }
  }
`

const Detail = styled.div`
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
  color: var(--ui-muted);
`

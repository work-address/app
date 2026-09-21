import { Skeleton } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { getInvoiceDocumentFields, type InvoiceDocumentSource } from '../model'

import { useDateFormatter } from '@/shared'

type Props = {
  invoice: InvoiceDocumentSource | null
  loading: boolean
}

/**
 * The invoice as a document: who it is from and to, with the wallet
 * addresses frozen at issuance, its full reference, the period it bills,
 * its currency and amount, and where it stands.
 *
 * On screen and on paper alike - it is what makes the saved PDF an invoice
 * rather than a screenshot of a dashboard. Every value wraps anywhere,
 * because addresses and ids have no break opportunities of their own and
 * would otherwise push a phone, or the page margin, sideways.
 */
export const InvoiceDocumentHeader = ({ invoice, loading }: Props) => {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()

  if (loading) {
    return <Skeleton width="100%" height="120px" />
  }

  const fields = getInvoiceDocumentFields(invoice, {
    t,
    formatDate: dateFormatter.format,
  })

  if (fields.length === 0) {
    return null
  }

  return (
    <Root aria-label={t('invoice.document.heading')}>
      {fields.map((field) => (
        <Item key={field.id} data-field={field.id}>
          <Label>{field.label}</Label>
          <Value>
            {field.value}
            {field.detail ? <Detail>{field.detail}</Detail> : null}
          </Value>
        </Item>
      ))}
    </Root>
  )
}

const Root = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: var(--space-3) var(--space-5);
  min-width: 0;
  margin: 0;

  @media print {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2) var(--space-4);
  }
`

const Item = styled.div`
  display: grid;
  align-content: start;
  gap: 2px;
  min-width: 0;

  @media print {
    break-inside: avoid;
  }
`

const Label = styled.dt`
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);
`

const Value = styled.dd`
  display: grid;
  gap: 2px;
  margin: 0;
  font-size: var(--font-size-3);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

const Detail = styled.span`
  font-size: var(--font-size-1);
  font-weight: 400;
  color: var(--ds-neutral-11);
  font-family: var(--code-font-family, monospace);
  overflow-wrap: anywhere;
`

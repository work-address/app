import { Badge } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  describeInvoiceEscrow,
  shortenAddress,
  type InvoiceEscrowFields,
  type InvoiceEscrowLayout,
  type InvoiceEscrowState,
} from '../model'

import type { BadgeProps } from '@radix-ui/themes'

import { Text, useDateFormatter } from '@/shared'

const STATE_COLOR: Record<InvoiceEscrowState, BadgeProps['color']> = {
  pending: 'gray',
  submitted: 'amber',
  released: 'green',
  disputed: 'red',
  expired: 'gray',
  cancelled: 'gray',
}

type Props = {
  invoice: InvoiceEscrowFields | null | undefined
  layout?: InvoiceEscrowLayout
  className?: string
}

/**
 * How the escrow settled an invoice submitted to it: its state, the bill on
 * chain, the 5% fee and the 95% paid out on a release, any refund to the
 * payer, and the settling transaction - linked to a block explorer where the
 * chain has one. Nothing at all for an invoice never submitted to escrow.
 *
 * Whoever can read the invoice sees it - its issuer and the project owner. A
 * viewer reads no invoice, so never reaches this.
 */
export const InvoiceEscrowSettlement = ({
  invoice,
  layout = 'page',
  className,
}: Props) => {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()
  const settlement = describeInvoiceEscrow(invoice)

  if (!settlement) {
    return null
  }

  const isPage = layout === 'page'

  return (
    <Root
      className={className}
      data-layout={layout}
      aria-label={t('invoice.escrow.heading')}
    >
      <Header>
        <Text
          size={isPage ? '4' : '1'}
          weight="medium"
          color={isPage ? undefined : 'gray'}
        >
          {t('invoice.escrow.heading')}
        </Text>
        <Badge
          size={isPage ? '2' : '1'}
          variant="soft"
          color={STATE_COLOR[settlement.state]}
        >
          {t(`invoice.escrow.state.${settlement.state}`)}
        </Badge>
      </Header>
      {isPage ? (
        <Caption size="2" color="gray">
          {t(
            settlement.lapsed
              ? 'invoice.escrow.lapsed'
              : 'invoice.escrow.description',
          )}
        </Caption>
      ) : null}
      {settlement.figures.length > 0 || settlement.txHash ? (
        <List>
          {settlement.figures.map((figure) => (
            <Item key={figure.id}>
              <Label>{t(`invoice.escrow.figure.${figure.id}`)}</Label>
              <Value>{figure.amount}</Value>
            </Item>
          ))}
          {settlement.confirmedAt ? (
            <Item>
              <Label>{t('invoice.escrow.confirmedAt')}</Label>
              <Value>
                {dateFormatter.format(new Date(settlement.confirmedAt))}
              </Value>
            </Item>
          ) : null}
          {settlement.txHash ? (
            <Item>
              <Label>{t('invoice.escrow.transaction')}</Label>
              <Value>
                {settlement.txUrl ? (
                  <TxLink
                    href={settlement.txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t('invoice.escrow.viewTransaction')}
                  >
                    {shortenAddress(settlement.txHash)}
                  </TxLink>
                ) : (
                  <TxHash title={settlement.txHash}>
                    {shortenAddress(settlement.txHash)}
                  </TxHash>
                )}
              </Value>
            </Item>
          ) : null}
        </List>
      ) : null}
    </Root>
  )
}

const Root = styled.section`
  display: grid;
  gap: var(--space-2);
  min-width: 0;

  &[data-layout='page'] {
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--gray-a5);
    border-radius: var(--radius-3);
  }

  &[data-layout='row'] {
    padding-top: var(--space-2);
    border-top: 1px dashed var(--gray-a5);
  }
`

const Header = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: var(--space-2);
`

const Caption = styled(Text)`
  max-width: 60ch;
`

const List = styled.dl`
  display: grid;
  margin: 0;

  /* Two columns even on a phone; one line of six on a desktop. */
  ${Root}[data-layout='page'] & {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: var(--space-3) var(--space-4);
  }

  ${Root}[data-layout='row'] & {
    grid-template-columns: repeat(auto-fill, minmax(140px, max-content));
    gap: var(--space-1) var(--space-5);
  }
`

/* A label that wraps grows upwards, so the figures on one line stay level. */
const Item = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 2px;
  min-width: 0;
`

const Label = styled.dt`
  align-self: end;
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);
`

const Value = styled.dd`
  margin: 0;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;

  ${Root}[data-layout='page'] & {
    font-size: var(--font-size-3);
  }

  ${Root}[data-layout='row'] & {
    font-size: var(--font-size-2);
  }
`

/* Above a list card's link overlay (see the invoices page), so the
   transaction opens rather than the invoice. */
const TxLink = styled.a`
  position: relative;
  z-index: 1;
  font-family: var(--code-font-family);
  color: var(--ds-accent-11);
  text-decoration: underline;
  text-underline-offset: 2px;

  @media print {
    color: inherit;
    text-decoration: none;
  }
`

const TxHash = styled.span`
  font-family: var(--code-font-family);
`

import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Badge, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  invoiceStateColor,
  invoiceStateLabelKey,
  useInvoiceInfoFields,
  type InvoiceFieldId,
} from '../lib'
import { $invoice, $invoiceLoading, getInvoicePageUrl } from '../model'

import { InvoiceActions } from './invoice-actions'

import {
  Card,
  formatCurrency,
  Hint,
  IconButton,
  PageHeader,
  StatStrip,
  StatTile,
  Text,
  Tooltip,
  useBreakpoint,
} from '@/shared'

/** The figures that answer "how much, for how long" at a glance. */
const HEADLINE_FIELD_IDS: InvoiceFieldId[] = [
  'timeTotal',
  'timeActive',
  'timeUnpaid',
]

/** Pixels the code is drawn at; CSS decides what it is shown at. */
const QR_DRAWN_SIZE = 194

type Props = {
  onBack: () => void
}

/** The invoice at a glance: who, how much, its state, and what can be done. */
export const InvoiceOverview = ({ onBack }: Props) => {
  const { t } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const fields = useInvoiceInfoFields()

  const { invoice, loading } = useUnit({
    invoice: $invoice,
    loading: $invoiceLoading,
  })

  const invoiceUrl = invoice?.id
    ? getInvoicePageUrl(window.location.origin, invoice.id)
    : ''
  const headline = HEADLINE_FIELD_IDS.flatMap(
    (id) => fields.find((field) => field.id === id) ?? [],
  )
  const facts = fields.filter(({ id }) => !HEADLINE_FIELD_IDS.includes(id))
  const payWallet = invoice?.user?.payWallet

  /* The state prints: a PDF that does not say whether it was paid is only half
     a record. */
  const stateBadge = loading ? (
    <Skeleton width="60px" height="22px" />
  ) : (
    <Badge size="2" variant="soft" color={invoiceStateColor(invoice)}>
      {t(invoiceStateLabelKey(invoice))}
    </Badge>
  )

  return (
    <Root>
      <Band>
        <PageHeader
          leading={
            <Tooltip content={t('common.back')}>
              <BackButton
                variant="ghost"
                radius="full"
                color="gray"
                aria-label={t('common.back')}
                onClick={onBack}
              >
                <ArrowLeftIcon width={20} height={20} />
              </BackButton>
            </Tooltip>
          }
          title={
            loading ? <Skeleton width="200px" height="35px" /> : invoice?.title
          }
          badge={isMobile ? undefined : stateBadge}
          /* On a phone the badge would squeeze the title onto two lines, so it
           leads the line below instead. */
          description={
            <Subtitle>
              {isMobile && stateBadge}
              {loading ? (
                <Skeleton width="220px" height="18px" />
              ) : (
                <Reference>
                  {t('invoices.item.reference')} {invoice?.id}
                </Reference>
              )}
            </Subtitle>
          }
          actions={<InvoiceActions layout={isMobile ? 'mobile' : 'desktop'} />}
        />
      </Band>
      <Stats>
        <Tile
          tone="accent"
          label={t('invoice.totalAmount')}
          value={formatCurrency(invoice?.totalAmount)}
          loading={loading}
        />
        {headline.map((field) => (
          <Tile
            key={field.id}
            label={
              <TileLabel>
                {t(`invoice.fields.${field.id}`)}
                {field.desc ? <Hint content={field.desc} size={14} /> : null}
              </TileLabel>
            }
            value={field.value}
            loading={loading}
          />
        ))}
      </Stats>
      <Details>
        <Qr>
          {loading ? (
            <Skeleton width="120px" height="120px" />
          ) : (
            <QRCodeSVG
              value={invoiceUrl}
              size={QR_DRAWN_SIZE}
              bgColor="transparent"
              fgColor="var(--ds-accent-11)"
              marginSize={1}
            />
          )}
          <Text size="1" color="gray" align="center">
            {t('invoice.qrScan')}
          </Text>
        </Qr>
        <Body>
          <Facts>
            {facts.map((field) => (
              <Fact key={field.id}>
                <Label>
                  <Text size="2" color="gray">
                    {t(`invoice.fields.${field.id}`)}
                  </Text>
                  {field.desc ? <Hint content={field.desc} size={14} /> : null}
                </Label>
                <dd>
                  {loading ? (
                    <Skeleton width="80px" height="20px" />
                  ) : (
                    <Text size="2" weight="medium">
                      {field.value}
                    </Text>
                  )}
                </dd>
              </Fact>
            ))}
          </Facts>
          {/* A Google account with no connected wallet is paid some other way,
              and an invoice has nothing to say about it here. */}
          {payWallet && (
            <PayTo size="2" color="gray">
              {t('invoice.fields.payTo')}:{' '}
              <PayToWallet size="2" weight="medium" highContrast>
                {payWallet}
              </PayToWallet>
            </PayTo>
          )}
        </Body>
      </Details>
    </Root>
  )
}

/* One card with one edge, its bands parted by hairlines. They lay out by the
   card's own width, not the viewport's: with the sidebar open a small desktop
   has less room than a phone-width rule would ever notice. On a phone the card
   is the page, as the profile's is. */
const Root = styled(Card)`
  container-type: inline-size;
  display: grid;
  min-width: 0;
  padding: 0;
  border: 1px solid var(--ds-neutral-alpha-6);

  ${(p) => p.theme.breakpoints.down('md')} {
    border: 0;
  }

  @media print {
    border: 0;
  }
`

const Band = styled.div`
  min-width: 0;
  padding: var(--space-4) var(--space-5);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 0 0 var(--space-3);
  }

  @media print {
    padding: 0 0 var(--space-2);
  }
`

/* Doubled: StatStrip's own phone rule comes from inside a media query. */
const Stats = styled(StatStrip)`
  && {
    gap: 0;
    border-top: 1px solid var(--ds-neutral-alpha-6);
    border-bottom: 1px solid var(--ds-neutral-alpha-6);
  }

  @container (max-width: 720px) {
    && {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`

/* A column of the band rather than a box inside it: a border inside the card's
   edge would be a second card. */
const Tile = styled(StatTile)`
  && {
    border: 0;
    border-radius: 0;
    background: none;
    padding: var(--space-3) var(--space-5);
  }

  & + & {
    border-left: 1px solid var(--ds-neutral-alpha-6);
  }

  @container (max-width: 720px) {
    &&:nth-child(odd) {
      border-left: 0;
    }

    &&:nth-child(n + 3) {
      border-top: 1px solid var(--ds-neutral-alpha-6);
    }
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    && {
      padding: var(--space-2) var(--space-3);
    }

    &&:nth-child(odd) {
      padding-left: 0;
    }
  }

  @media print {
    && {
      padding: var(--space-2) var(--space-3);
    }
  }
`

const BackButton = styled(IconButton)`
  @media print {
    display: none;
  }
`

const Subtitle = styled.span`
  display: grid;
  justify-items: start;
  gap: var(--space-1);
`

/* An id has no break opportunities of its own; without this a long one pushes
   the page wider than the phone. */
const Reference = styled.span`
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
`

const TileLabel = styled.span`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-1);
`

/* The code beside the facts. */
const Details = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3) var(--space-5);
  padding: var(--space-4) var(--space-5);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--space-3) 0 0;
  }

  @container (max-width: 480px) {
    grid-template-columns: minmax(0, 1fr);
  }

  @media print {
    padding: var(--space-2) 0 0;
  }
`

const Qr = styled.div`
  display: grid;
  justify-items: center;
  gap: var(--space-1);

  svg {
    width: 120px;
    height: 120px;
  }

  /* Below the facts on a phone: nobody scans the phone they are holding. */
  @container (max-width: 480px) {
    order: 1;
  }
`

const Body = styled.div`
  display: grid;
  gap: var(--space-3);
  min-width: 0;
`

/* Columns filled down the first, so the values of each line up on one edge
   however long the labels beside them are: three when the card is wide, two
   when it is not, and one when even that would squeeze them. */
const Facts = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, max-content minmax(0, 1fr));
  grid-template-rows: repeat(2, auto);
  grid-auto-flow: column;
  gap: var(--space-1) var(--space-3);
  margin: 0;

  @container (max-width: 1120px) {
    grid-template-columns: repeat(2, max-content minmax(0, 1fr));
    grid-template-rows: repeat(3, auto);
  }

  @container (max-width: 720px) {
    grid-template-columns: max-content minmax(0, 1fr);
    grid-template-rows: none;
    grid-auto-flow: row;
  }
`

const Fact = styled.div`
  grid-column: span 2;
  display: grid;
  grid-template-columns: subgrid;
  column-gap: var(--space-3);
  align-items: center;
  min-height: 32px;

  dd {
    margin: 0;
    min-width: 0;
  }
`

/* The label keeps to one line whatever it says, so the value and the hint stay
   level with it. */
const Label = styled.dt`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: var(--space-1);
  white-space: nowrap;
`

const PayTo = styled(Text)`
  padding-top: var(--space-3);
  border-top: 1px solid var(--ds-neutral-alpha-6);
  overflow-wrap: anywhere;
`

/* Inline, so the address follows its label and wraps there rather than
   dropping to a line of its own as one block. Doubled to outrank Text's
   inline-block. */
const PayToWallet = styled(Text)`
  && {
    display: inline;
  }
`

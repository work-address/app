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
  formatCurrency,
  Hint,
  IconButton,
  LogoWordmark,
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
    <Badge
      size="2"
      radius="full"
      variant="soft"
      color={invoiceStateColor(invoice)}
    >
      {t(invoiceStateLabelKey(invoice))}
    </Badge>
  )

  return (
    <Root>
      {/* On paper nothing else says what this is or whose: the app around it,
          with its name in the sidebar, did not print. */}
      <Masthead>
        <img src={LogoWordmark} alt={t('header.logoAlt')} />
        <Text size="3" color="gray">
          {t('app.documentTitle.invoice')}
        </Text>
      </Masthead>
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
      <Sheet>
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
                fgColor="var(--ui-ink)"
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
                    {field.desc ? (
                      <Hint content={field.desc} size={14} />
                    ) : null}
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
      </Sheet>
    </Root>
  )
}

/* Bands parted by hairlines. They lay out by the page's own width, not the
   viewport's: with the sidebar open a small desktop has less room than a
   phone-width rule would ever notice. */
const Root = styled.section`
  container-type: inline-size;
  display: grid;
  gap: var(--ui-section-gap);
  min-width: 0;

  /* Blocks, and no container: the rules below that go by the page's width are
     for the screen's sidebar, and paper always lays out the one way. */
  @media print {
    container-type: normal;
    display: block;
  }
`

const Masthead = styled.div`
  display: none;

  @media print {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: var(--ui-space-4);

    img {
      display: block;
      height: 20px;
    }
  }
`

const Band = styled.div`
  min-width: 0;

  @media print {
    --font-size-5: 22px;
    --font-size-7: 22px;
    --ui-figure-size: 22px;
    --ui-title-mobile-size: 22px;
    --ui-title-size: 22px;
    --ui-title-line-height: 28px;

    padding: 0 0 var(--ui-space-3);
  }
`

/* The figures and the facts behind them on one white sheet. Paper keeps
   only the content: no box, no shadow. */
const Sheet = styled.div`
  display: grid;
  min-width: 0;
  padding: var(--ui-space-2) var(--ui-card-inset) var(--ui-card-inset);
  border: var(--ui-border-width) solid var(--ui-edge);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding-inline: var(--ui-card-inset-mobile);
    padding-bottom: var(--ui-card-inset-mobile);
  }

  @media print {
    display: block;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
`

/* Doubled: StatStrip's own phone rule comes from inside a media query. */
const Stats = styled(StatStrip)`
  && {
    gap: 0;
    border-bottom: var(--ui-border-width) solid var(--ui-line);
  }

  @media print {
    && {
      border-top: 1px solid var(--ui-line);
      border-bottom: 1px solid var(--ui-line);
    }
  }

  @container (max-width: 720px) {
    && {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media print {
    --font-size-5: 16px;
    --font-size-6: 16px;
    --ui-figure-size: 16px;
    --ui-metric-min-size: 16px;
    --stat-tile-size: 16px;

    && {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
`

/* A column of the band rather than a box inside it, starting on the column's
   own left edge so the first figure sits level with the title. */
const Tile = styled(StatTile)`
  && {
    border: 0;
    border-radius: 0;
    background: none;
    padding: var(--ui-space-4) var(--ui-space-5) var(--ui-space-4) 0;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    && {
      padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-3) 0;
    }
  }

  /* The first keeps to the paper's left edge, under the title. */
  @media print {
    &&& {
      padding: var(--ui-space-2) var(--ui-space-3);
    }

    &&&:first-child {
      padding-left: 0;
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
  gap: var(--ui-space-1);
`

/* An id has no break opportunities of its own; without this a long one pushes
   the page wider than the phone. */
const Reference = styled.span`
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
`

const TileLabel = styled.span`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--ui-space-1);
`

/* The code beside the facts; on paper it moves to the far side, so the facts
   stay on the left edge every other line of the invoice starts from. */
const Details = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-space-3) var(--ui-space-5);
  padding: var(--ui-space-5) 0 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--ui-space-4) 0 0;
  }

  @container (max-width: 480px) {
    grid-template-columns: minmax(0, 1fr);
  }

  @media print {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    padding: var(--ui-space-3) 0 0;
  }
`

const Qr = styled.div`
  display: grid;
  justify-items: center;
  gap: var(--ui-space-1);

  svg {
    width: 120px;
    height: 120px;
  }

  /* Below the facts on a phone: nobody scans the phone they are holding. */
  @container (max-width: 480px) {
    order: 1;
  }

  /* As wide as the code, so the caption wraps under it instead of pushing it
     off the right edge. */
  @media print {
    order: 1;
    width: 88px;

    svg {
      width: 88px;
      height: 88px;
    }
  }
`

const Body = styled.div`
  display: grid;
  gap: var(--ui-space-3);
  min-width: 0;
`

/* Columns filled down the first, so the values of each line up on one edge
   however long the labels beside them are: three when the page is wide, two
   when it is not, and one when even that would squeeze them. */
const Facts = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, max-content minmax(0, 1fr));
  grid-template-rows: repeat(2, auto);
  grid-auto-flow: column;
  gap: var(--ui-space-1) var(--ui-space-3);
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

  @media print {
    grid-template-columns: repeat(2, max-content minmax(0, 1fr));
    grid-template-rows: repeat(3, auto);
    grid-auto-flow: column;
    gap: 0 var(--ui-space-3);
  }
`

const Fact = styled.div`
  grid-column: span 2;
  display: grid;
  grid-template-columns: subgrid;
  column-gap: var(--ui-space-3);
  align-items: center;
  min-height: 32px;

  dd {
    margin: 0;
    min-width: 0;
  }

  @media print {
    min-height: 22px;
  }
`

/* The label keeps to one line whatever it says, so the value and the hint stay
   level with it. */
const Label = styled.dt`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: var(--ui-space-1);
  white-space: nowrap;
`

const PayTo = styled(Text)`
  padding-top: var(--ui-space-3);
  border-top: var(--ui-border-width) solid var(--ui-line);
  overflow-wrap: anywhere;

  @media print {
    padding-top: var(--ui-space-2);
  }
`

/* Inline, so the address follows its label and wraps there rather than
   dropping to a line of its own as one block. Doubled to outrank Text's
   inline-block. */
const PayToWallet = styled(Text)`
  && {
    display: inline;
  }
`

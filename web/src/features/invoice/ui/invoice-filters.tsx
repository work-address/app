import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $invoiceAmountFilter,
  $invoicePeriodFilter,
  $invoiceProjectFilter,
  $invoiceStateFilter,
  $invoiceSummary,
  invoiceAmountFilterChanged,
  invoicePeriodFilterChanged,
  invoiceProjectFilterChanged,
  invoiceProjectsQuery,
  invoiceStateFilterChanged,
  isInvoiceAmountInput,
  type InvoiceStateFilter,
} from '../model'

import {
  Button,
  DatePickerInput,
  Drawer,
  FilterIcon,
  Input,
  ListPageLayout as S,
  Select,
  Text,
  ToolbarSegment,
  ToolbarShell,
} from '@/shared'

const STATE_OPTIONS: { value: InvoiceStateFilter; labelKey: string }[] = [
  { value: '', labelKey: 'invoices.filter.state.all' },
  { value: 'Requested', labelKey: 'invoices.filter.state.awaiting' },
  { value: 'PAID', labelKey: 'invoices.filter.state.paid' },
  { value: 'REJECTED', labelKey: 'invoices.filter.state.rejected' },
]

const FROM_ID = 'invoiceFromAt'
const TO_ID = 'invoiceToAt'
const AMOUNT_MIN_ID = 'invoiceAmountMin'
const AMOUNT_MAX_ID = 'invoiceAmountMax'

/**
 * The list's scope beside the page title on a desktop: which project and
 * which period. Applied as they change.
 */
export const InvoiceScopeFilters = () => (
  <Scope>
    <ProjectField labelHidden />
    <PeriodField labelHidden />
  </Scope>
)

/** The panel's row on a desktop: the status as tabs, then the amount. */
export const InvoiceFilters = () => (
  <Row>
    <StatusTabs />
    <Amount>
      <AmountField />
    </Amount>
  </Row>
)

/** A phone has no room for the row: every field, one button away. */
export const InvoiceMobileFilters = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={<Flex justify="center">{t('dashboard.page.filters.title')}</Flex>}
      trigger={
        <Button
          color="neutral"
          variant="outline"
          stretch
          iconLeft={
            <S.FilterImage
              src={FilterIcon}
              alt={t('dashboard.page.filters.filterIconAlt')}
              width={20}
              height={20}
            />
          }
        >
          {t('dashboard.page.filters.title')}
        </Button>
      }
      footer={
        <Button stretch onClick={() => setOpen(false)}>
          {t('dashboard.page.filters.apply')}
        </Button>
      }
    >
      <Flex direction="column" gap="2">
        <ProjectField />
        <StatusField />
        <PeriodField />
        <AmountField />
      </Flex>
    </Drawer>
  )
}

/* The page reports a failed project list and offers its retry. */
const ProjectField = ({ labelHidden }: { labelHidden?: boolean }) => {
  const { t } = useTranslation()
  const { projectId, changeProject, projects, projectsFailed } = useUnit({
    projectId: $invoiceProjectFilter,
    changeProject: invoiceProjectFilterChanged,
    projects: invoiceProjectsQuery.$data,
    projectsFailed: invoiceProjectsQuery.$failed,
  })

  const options = useMemo(
    () => [
      { value: '', label: t('invoices.filter.allProjects') },
      ...(projects ?? []).map((project) => ({
        value: project.id ?? '',
        label: project.title ?? '',
      })),
    ],
    [projects, t],
  )

  if (projectsFailed) {
    return null
  }

  return (
    <Field>
      <Select
        label={t('invoices.item.project')}
        labelHidden={labelHidden}
        options={options}
        value={projectId}
        placeholder={t('invoices.filter.allProjects')}
        onChange={(value) => {
          if (!Array.isArray(value)) {
            changeProject(value)
          }
        }}
      />
    </Field>
  )
}

const useStateOptions = () => {
  const { t } = useTranslation()

  return useMemo(
    () =>
      STATE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  )
}

const StatusField = () => {
  const { t } = useTranslation()
  const options = useStateOptions()
  const { state, changeState } = useUnit({
    state: $invoiceStateFilter,
    changeState: invoiceStateFilterChanged,
  })

  return (
    <Select
      label={t('invoices.item.status')}
      options={options}
      value={state}
      onChange={(value) => {
        if (!Array.isArray(value)) {
          changeState(value as InvoiceStateFilter)
        }
      }}
    />
  )
}

/**
 * The status filter as tabs: every state one press away. Awaiting and paid
 * carry the counts the totals above already show.
 */
const StatusTabs = () => {
  const { t } = useTranslation()
  const options = useStateOptions()
  const { state, changeState, summary } = useUnit({
    state: $invoiceStateFilter,
    changeState: invoiceStateFilterChanged,
    summary: $invoiceSummary,
  })

  const counts: Partial<Record<InvoiceStateFilter, number>> = {
    Requested: summary.requestedCount,
    PAID: summary.paidCount,
  }

  return (
    <Tabs role="group" aria-label={t('invoices.item.status')}>
      {options.map((option) => (
        <ToolbarSegment
          key={option.value || 'all'}
          type="button"
          aria-pressed={state === option.value}
          onClick={() => changeState(option.value)}
        >
          {option.label}
          {counts[option.value] === undefined ? null : (
            <TabCount>{counts[option.value]}</TabCount>
          )}
        </ToolbarSegment>
      ))}
    </Tabs>
  )
}

const PeriodField = ({ labelHidden }: { labelHidden?: boolean }) => {
  const { t } = useTranslation()
  const { period, changePeriod } = useUnit({
    period: $invoicePeriodFilter,
    changePeriod: invoicePeriodFilterChanged,
  })

  const from = useMemo(
    () => (period.fromAt === null ? null : new Date(period.fromAt)),
    [period.fromAt],
  )
  const to = useMemo(
    () => (period.toAt === null ? null : new Date(period.toAt)),
    [period.toAt],
  )

  const pickers = (
    <Pair>
      <DatePickerInput
        id={FROM_ID}
        value={from}
        onChange={(date) => changePeriod({ fromAt: date?.getTime() ?? null })}
        placeholder={t('dashboard.page.filters.from')}
      />
      <DatePickerInput
        id={TO_ID}
        value={to}
        onChange={(date) => changePeriod({ toAt: date?.getTime() ?? null })}
        placeholder={t('dashboard.page.filters.to')}
      />
    </Pair>
  )

  // Beside the title the placeholders say what the fields are.
  if (labelHidden) {
    return pickers
  }

  return (
    <Group>
      <Text
        size="2"
        weight="medium"
        as="label"
        htmlFor={period.fromAt === null ? FROM_ID : TO_ID}
      >
        {t('invoices.item.period')}
      </Text>
      {pickers}
    </Group>
  )
}

const AmountField = () => {
  const { t } = useTranslation()
  const { amount, changeAmount } = useUnit({
    amount: $invoiceAmountFilter,
    changeAmount: invoiceAmountFilterChanged,
  })

  const amountLabel = t('invoices.item.amount')
  const minPlaceholder = t('dashboard.page.filters.min')
  const maxPlaceholder = t('dashboard.page.filters.max')

  return (
    <Group>
      <Text
        size="2"
        weight="medium"
        as="label"
        htmlFor={amount.min ? AMOUNT_MAX_ID : AMOUNT_MIN_ID}
      >
        {amountLabel}
      </Text>
      <Pair>
        <Input
          id={AMOUNT_MIN_ID}
          inputMode="decimal"
          aria-label={`${amountLabel}: ${minPlaceholder}`}
          placeholder={minPlaceholder}
          value={amount.min}
          onChange={(event) => {
            if (isInvoiceAmountInput(event.target.value)) {
              changeAmount({ min: event.target.value })
            }
          }}
        />
        <Input
          id={AMOUNT_MAX_ID}
          inputMode="decimal"
          aria-label={`${amountLabel}: ${maxPlaceholder}`}
          placeholder={maxPlaceholder}
          value={amount.max}
          onChange={(event) => {
            if (isInvoiceAmountInput(event.target.value)) {
              changeAmount({ max: event.target.value })
            }
          }}
        />
      </Pair>
    </Group>
  )
}

/* The dashboard's filter geometry: page-level controls at the filter height. */
const Scope = styled.div`
  --select-trigger-height: var(--ui-filter-height);
  --select-trigger-padding: var(--ui-space-4);
  --date-field-height: var(--ui-filter-height);
  --date-field-padding: var(--ui-space-4);

  display: grid;
  grid-template-columns: var(--ui-filter-width) auto;
  justify-content: end;
  gap: var(--ui-space-3);

  & > :last-child {
    grid-template-columns: repeat(2, var(--ui-filter-width));
  }

  ${(p) => p.theme.breakpoints.down('xl')} {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    justify-content: stretch;

    & > :last-child {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`

/* Tabs on the left, the amount at the far end, level with their bottoms. */
const Row = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, var(--ui-search-width));
  justify-content: space-between;
  align-items: end;
  gap: var(--ui-space-4);

  ${(p) => p.theme.breakpoints.down('lg')} {
    grid-template-columns: minmax(0, 1fr);
    justify-content: stretch;
  }
`

const Tabs = styled(ToolbarShell)`
  justify-self: start;
`

const TabCount = styled.span`
  min-width: var(--ui-space-5);
  padding-inline: var(--ui-space-1);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-inset);
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-space-5);
  text-align: center;
`

const Amount = styled.div`
  min-width: 0;
`

const Field = styled.div`
  min-width: 0;
`

const Group = styled.div`
  display: grid;
  gap: var(--ui-space-2);
  min-width: 0;
`

const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-2);
  min-width: 0;
`

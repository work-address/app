import { Flex, Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $invoiceAmountFilter,
  $invoicePeriodFilter,
  $invoiceProjectFilter,
  $invoiceStateFilter,
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
} from '@/shared'

const STATE_OPTIONS: { value: InvoiceStateFilter; labelKey: string }[] = [
  { value: '', labelKey: 'invoices.filter.state.all' },
  { value: 'Requested', labelKey: 'invoices.filter.state.awaiting' },
  { value: 'REJECTED', labelKey: 'invoices.filter.state.rejected' },
  { value: 'PAID', labelKey: 'invoices.filter.state.paid' },
]

const FROM_ID = 'invoiceFromAt'
const TO_ID = 'invoiceToAt'
const AMOUNT_MIN_ID = 'invoiceAmountMin'
const AMOUNT_MAX_ID = 'invoiceAmountMax'

/** The desktop row, set like the time page's filters. */
export const InvoiceFilters = () => (
  <Root>
    <InvoiceFilterFields />
  </Root>
)

/** A phone has no room for the row: the same fields, one button away. */
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
          size="s"
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
        <InvoiceFilterFields />
      </Flex>
    </Drawer>
  )
}

const InvoiceFilterFields = () => {
  const { t } = useTranslation()

  const {
    projectId,
    changeProject,
    state,
    changeState,
    period,
    changePeriod,
    amount,
    changeAmount,
    projects,
    projectsFailed,
  } = useUnit({
    projectId: $invoiceProjectFilter,
    changeProject: invoiceProjectFilterChanged,
    state: $invoiceStateFilter,
    changeState: invoiceStateFilterChanged,
    period: $invoicePeriodFilter,
    changePeriod: invoicePeriodFilterChanged,
    amount: $invoiceAmountFilter,
    changeAmount: invoiceAmountFilterChanged,
    projects: invoiceProjectsQuery.$data,
    projectsFailed: invoiceProjectsQuery.$failed,
  })

  const projectOptions = useMemo(
    () => [
      { value: '', label: t('invoices.filter.allProjects') },
      ...(projects ?? []).map((project) => ({
        value: project.id ?? '',
        label: project.title ?? '',
      })),
    ],
    [projects, t],
  )

  const stateOptions = useMemo(
    () =>
      STATE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  )

  const from = useMemo(
    () => (period.fromAt === null ? null : new Date(period.fromAt)),
    [period.fromAt],
  )
  const to = useMemo(
    () => (period.toAt === null ? null : new Date(period.toAt)),
    [period.toAt],
  )

  const amountLabel = t('invoices.item.amount')
  const minPlaceholder = t('dashboard.page.filters.min')
  const maxPlaceholder = t('dashboard.page.filters.max')

  return (
    <>
      {/* The page reports a failed project list and offers its retry. */}
      {projectsFailed ? null : (
        <Field>
          <Select
            label={t('invoices.item.project')}
            options={projectOptions}
            value={projectId}
            placeholder={t('invoices.filter.allProjects')}
            onChange={(value) => {
              if (!Array.isArray(value)) {
                changeProject(value)
              }
            }}
          />
        </Field>
      )}
      <Field>
        <Select
          label={t('invoices.item.status')}
          options={stateOptions}
          value={state}
          onChange={(value) => {
            if (!Array.isArray(value)) {
              changeState(value as InvoiceStateFilter)
            }
          }}
        />
      </Field>
      <Field data-span="2">
        <Grid gap="2">
          <Text
            size="2"
            weight="medium"
            as="label"
            htmlFor={period.fromAt === null ? FROM_ID : TO_ID}
          >
            {t('invoices.item.period')}
          </Text>
          <Grid columns="1fr 1fr" gap="2">
            <DatePickerInput
              id={FROM_ID}
              value={from}
              onChange={(date) =>
                changePeriod({ fromAt: date?.getTime() ?? null })
              }
              placeholder={t('dashboard.page.filters.from')}
            />
            <DatePickerInput
              id={TO_ID}
              value={to}
              onChange={(date) =>
                changePeriod({ toAt: date?.getTime() ?? null })
              }
              placeholder={t('dashboard.page.filters.to')}
            />
          </Grid>
        </Grid>
      </Field>
      <Field>
        <Grid gap="2">
          <Text
            size="2"
            weight="medium"
            as="label"
            htmlFor={amount.min ? AMOUNT_MAX_ID : AMOUNT_MIN_ID}
          >
            {amountLabel}
          </Text>
          <Grid columns="1fr 1fr" gap="2">
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
          </Grid>
        </Grid>
      </Field>
    </>
  )
}

/* Fields wrap onto a second line when the page runs narrow, rather than
   squeezing until a date field shows three characters of its placeholder. */
const Root = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: var(--space-3);
`

/* The period holds two date inputs, so it takes two columns. */
const Field = styled.div`
  min-width: 0;

  &[data-span='2'] {
    grid-column: span 2;
  }
`

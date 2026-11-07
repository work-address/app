import { Badge, Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { $user } from '@/entities/profile'
import {
  $hasMoreInvoices,
  $invoiceHasActiveFilters,
  $invoiceSort,
  $invoiceSummary,
  $invoiceSummaryLoading,
  $invoiceSummaryFailed,
  $invoices,
  $invoicesTotal,
  $isLoadingMoreInvoices,
  INVOICE_SORT_FIELDS,
  InvoiceFilters,
  InvoiceMobileFilters,
  InvoiceScopeFilters,
  InvoicePaymentActions,
  InvoicesTable,
  canSettleInvoice,
  fetchInvoiceList,
  retryInvoiceList,
  retryInvoiceSummary,
  formatCents,
  invoiceFiltersReset,
  invoiceListQuery,
  invoiceProjectsQuery,
  invoiceRateHour,
  invoiceSortChanged,
  invoiceStateTone,
  invoiceStateLabelKey,
  loadMoreInvoices,
  shortenAddress,
  type InvoiceSortField,
  type InvoiceSortOrder,
} from '@/features/invoice'
import { routes } from '@/routes'
import { formatCurrency, useDateFormatter, type baseApi } from '@/shared'
import {
  Button,
  LoadFailure,
  PageHelmet,
  SortSelect,
  Spinner,
  StateNotice,
  Text,
  WorkspaceFreshness,
  WorkspaceMetric,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
  WorkspaceStatus,
  WorkspaceSummary,
  useBreakpoint,
  usePageBusy,
  useReachEnd,
} from '@/shared'

/**
 * Every invoice the signed-in user can see, newest first.
 *
 * One list rather than one per project: an invoice is a money record, and the
 * question it answers - what am I owed, what have I paid - spans projects. The
 * strip at the top answers it outright; the rows are the evidence.
 */
export default function InvoicesPage() {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const navigate = useNavigate()

  const {
    rows,
    total,
    hasMore,
    pending,
    loadingMore,
    failed,
    fetchList,
    retryList,
    loadMore,
    isFiltered,
    resetFilters,
    summary,
    summaryLoading,
    summaryFailed,
    retrySummary,
    projectsFailed,
    loadProjects,
  } = useUnit({
    rows: $invoices,
    total: $invoicesTotal,
    hasMore: $hasMoreInvoices,
    pending: invoiceListQuery.$pending,
    loadingMore: $isLoadingMoreInvoices,
    failed: invoiceListQuery.$failed,
    fetchList: fetchInvoiceList,
    retryList: retryInvoiceList,
    loadMore: loadMoreInvoices,
    isFiltered: $invoiceHasActiveFilters,
    resetFilters: invoiceFiltersReset,
    summary: $invoiceSummary,
    summaryLoading: $invoiceSummaryLoading,
    summaryFailed: $invoiceSummaryFailed,
    retrySummary: retryInvoiceSummary,
    projectsFailed: invoiceProjectsQuery.$failed,
    loadProjects: invoiceProjectsQuery.start,
  })

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const showSkeleton = pending && !loadingMore && rows.length === 0
  const showEmpty = !pending && !failed && rows.length === 0

  // A re-sort keeps the old rows until the new ones land; the bar says it's on.
  usePageBusy(pending && !loadingMore && rows.length > 0)

  // Withheld while a request runs, so the observer re-arms when it lands: a
  // screen tall enough to still show the end asks for the next page by itself,
  // even after a reload that left the row count as it was.
  const sentinelRef = useReachEnd({
    onReachEnd: hasMore && !pending && !failed ? loadMore : undefined,
    resetKey: rows.length,
  })

  return (
    <Root>
      <PageHelmet
        title={t('invoices.page.title')}
        description={t('invoices.page.meta')}
      />
      <WorkspacePageHeader
        eyebrow={t('invoices.page.eyebrow')}
        title={t('invoices.page.title')}
        description={t('invoices.page.description')}
        actions={
          <HeaderTools>
            <Freshness
              pending={pending || summaryLoading}
              failed={failed || summaryFailed}
            />
            {/* Which project and which period: the list's scope, beside the
                title as on the dashboard. A phone keeps them in its drawer. */}
            {isDesktop ? <InvoiceScopeFilters /> : null}
          </HeaderTools>
        }
      />
      {/* The answer to "what am I owed" before the rows that justify it. */}
      {summaryFailed ? (
        <LoadFailure
          title={t('invoices.summary.loadFailure.title')}
          onRetry={retrySummary}
        />
      ) : (
        <WorkspaceSummary columns={3}>
          <WorkspaceMetric
            label={t('invoices.summary.awaiting')}
            value={formatCents(summary.requestedCents)}
            hint={t('invoices.summary.count', {
              count: summary.requestedCount,
            })}
            loading={summaryLoading}
          />
          <WorkspaceMetric
            label={t('invoices.summary.paid')}
            value={formatCents(summary.paidCents)}
            hint={t('invoices.summary.count', { count: summary.paidCount })}
            loading={summaryLoading}
          />
          <WorkspaceMetric
            label={t('invoices.summary.total')}
            value={formatCents(summary.totalCents)}
            hint={t('invoices.summary.count', { count: summary.totalCount })}
            loading={summaryLoading}
          />
        </WorkspaceSummary>
      )}
      <WorkspacePanel
        title={t('invoices.panel.title')}
        aside={
          <Tools>
            <ShownCount
              shown={rows.length}
              total={total}
              loading={showSkeleton}
            />
            {/* The list's own order, on every width: the table's headers
                cover only its columns, and a phone's cards have none. */}
            {rows.length > 1 ? <InvoiceSort /> : null}
          </Tools>
        }
        toolbar={
          <Toolbar>
            {projectsFailed && (
              <LoadFailure
                title={t('invoices.filter.projectsFailure.title')}
                onRetry={() => loadProjects()}
              />
            )}
            {isDesktop ? <InvoiceFilters /> : <InvoiceMobileFilters />}
          </Toolbar>
        }
      >
        <Content>
          {/* A failed request is not an empty list. Saying "no invoices yet"
              when the truth is "could not load them" sends someone looking
              for an invoice they know exists. With rows on screen they stay,
              and the failure sits under them. */}
          {failed && rows.length === 0 ? (
            <LoadFailure
              title={t('invoices.page.error.title')}
              description={t('invoices.page.error.description')}
              onRetry={() => fetchList()}
            />
          ) : showEmpty ? (
            <StateNotice
              title={t(
                isFiltered
                  ? 'invoices.page.empty.filtered.title'
                  : 'invoices.page.empty.title',
              )}
              description={t(
                isFiltered
                  ? 'invoices.page.empty.filtered.description'
                  : 'invoices.page.empty.description',
              )}
              actions={
                isFiltered ? (
                  <Button variant="outline" onClick={() => resetFilters()}>
                    {t('invoices.page.empty.filtered.reset')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => navigate(routes.dashboard.build())}
                  >
                    {t('invoices.page.empty.action')}
                  </Button>
                )
              }
            />
          ) : isDesktop ? (
            <InvoicesTable rows={rows} loading={showSkeleton} />
          ) : (
            <InvoiceCards
              rows={rows}
              showSkeleton={showSkeleton}
              pending={pending}
            />
          )}
          {failed && rows.length > 0 ? (
            <LoadFailure
              title={t('invoices.page.error.moreTitle')}
              description={t('invoices.page.error.description')}
              onRetry={() => retryList()}
            />
          ) : null}
          {hasMore && !failed ? (
            <>
              {loadingMore ? (
                <LoadingMore>
                  <Spinner size={32} />
                </LoadingMore>
              ) : null}
              <Sentinel ref={sentinelRef} aria-hidden />
            </>
          ) : null}
          {/* How much of the list is on screen, under it. */}
          {rows.length > 0 && !showSkeleton ? (
            <Shown>
              {t('invoices.page.shownOfTotal', {
                shown: rows.length,
                total,
              })}
            </Shown>
          ) : null}
        </Content>
      </WorkspacePanel>
    </Root>
  )
}

const ShownCount = ({
  shown,
  total,
  loading,
}: {
  shown: number
  total: number
  loading: boolean
}) => {
  const { t } = useTranslation()

  if (total === 0 || loading) {
    return null
  }

  // The total beside the title; how many of them are loaded, under the list.
  return shown < total ? (
    <Count title={t('invoices.page.shownOfTotal', { shown, total })}>
      {t('invoices.summary.count', { count: total })}
    </Count>
  ) : (
    <Count>{t('invoices.summary.count', { count: total })}</Count>
  )
}

const InvoiceSort = () => {
  const { t } = useTranslation()
  const { sort, changeSort } = useUnit({
    sort: $invoiceSort,
    changeSort: invoiceSortChanged,
  })

  const sortOptions = useMemo(
    () =>
      INVOICE_SORT_FIELDS.map((entry) => ({
        value: entry.field,
        label: t(entry.labelKey),
      })),
    [t],
  )

  const [sortField, sortOrder] = Object.entries(sort)[0] as [
    InvoiceSortField,
    InvoiceSortOrder,
  ]

  return (
    <Flex>
      <SortSelect
        options={sortOptions}
        field={sortField}
        order={sortOrder}
        onChange={(field, order) => changeSort({ [field]: order })}
      />
    </Flex>
  )
}

/** What a phone gets instead of the table: one card per invoice. */
const InvoiceCards = ({
  rows,
  showSkeleton,
  pending,
}: {
  rows: baseApi.InvoiceSearch[]
  showSkeleton: boolean
  pending: boolean
}) => {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()
  const user = useUnit($user)

  const formatDate = (value: string | undefined) =>
    value ? dateFormatter.format(new Date(value)) : '—'

  const formatPeriod = (from: string | undefined, to: string | undefined) =>
    from && to ? dateFormatter.formatRange(new Date(from), new Date(to)) : '—'

  return (
    <List aria-label={t('invoices.page.title')} aria-busy={pending}>
      {showSkeleton ? [0, 1, 2].map((row) => <SkeletonRow key={row} />) : null}
      {rows.map((invoice) => {
        const isPaid = invoice.state === 'PAID'
        const canSettle = canSettleInvoice(invoice, user)
        const rateHour = invoiceRateHour(invoice)
        const issuer =
          invoice.user?.name || shortenAddress(invoice.user?.address ?? '')

        return (
          <Row key={invoice.id}>
            <Cell $area="project">
              <ProjectLink
                to={routes.invoice.build({ id: invoice.id as string })}
              >
                <Text size="3" weight="medium" truncate>
                  {invoice.project?.title ?? '—'}
                </Text>
              </ProjectLink>
              <Text size="1" color="gray" truncate>
                {t('invoices.item.reference')}{' '}
                {shortenAddress(invoice.id ?? '')}
              </Text>
            </Cell>
            <Cell $area="status" label={t('invoices.item.status')}>
              <Flex direction="column" align="start" gap="1">
                <WorkspaceStatus tone={invoiceStateTone(invoice)}>
                  {t(invoiceStateLabelKey(invoice))}
                </WorkspaceStatus>
                {isPaid ? (
                  <Text size="1" color="gray">
                    {formatDate(invoice.paidAt)}
                  </Text>
                ) : null}
              </Flex>
            </Cell>
            <Cell $area="issuedBy" label={t('invoices.item.issuedBy')}>
              <Text size="2" truncate>
                {issuer}
              </Text>
            </Cell>
            <Cell $area="period" label={t('invoices.item.period')}>
              <Text size="2">{formatPeriod(invoice.fromAt, invoice.toAt)}</Text>
            </Cell>
            <Cell $area="issued" label={t('invoices.item.issued')}>
              <Text size="2">{formatDate(invoice.createdAt)}</Text>
            </Cell>
            <Cell $area="amount" $align="end" label={t('invoices.item.amount')}>
              <Text size="4" weight="medium">
                {formatCents(Number(invoice.amountCents ?? 0))}
              </Text>
              {/* The frozen line rate, or the project's rate for an
                      invoice issued before lines were stored. */}
              {rateHour != null && (
                <Text size="1" color="gray">
                  {t('invoices.item.perHour', {
                    rate: formatCurrency(rateHour),
                  })}
                </Text>
              )}
            </Cell>
            <Cell $area="action" $align="end">
              <InvoicePaymentActions
                invoiceId={invoice.id as string}
                isPaid={isPaid}
                canSettle={canSettle}
                stretch
              />
            </Cell>
          </Row>
        )
      })}
    </List>
  )
}

/**
 * The loading state is a real card with its text covered rather than a plain
 * block, so the skeleton and the invoice that replaces it have the same height
 * and the same layout - the list does not reflow when data lands.
 */
const SkeletonRow = () => (
  <Row aria-hidden>
    <Cell $area="project">
      <Skeleton>
        <Text size="3" weight="medium">
          Project name
        </Text>
      </Skeleton>
      <Skeleton>
        <Text size="1">Reference 000000…0000</Text>
      </Skeleton>
    </Cell>
    <Cell $area="status">
      <Skeleton>
        <Badge size="2">Awaiting payment</Badge>
      </Skeleton>
    </Cell>
    <Cell $area="issuedBy">
      <Skeleton>
        <Text size="2">Issuer name</Text>
      </Skeleton>
    </Cell>
    <Cell $area="period">
      <Skeleton>
        <Text size="2">00th – 00th Aug 0000</Text>
      </Skeleton>
    </Cell>
    <Cell $area="issued">
      <Skeleton>
        <Text size="2">00th Aug 0000</Text>
      </Skeleton>
    </Cell>
    <Cell $area="amount" $align="end">
      <Skeleton>
        <Text size="4" weight="medium">
          $0000.00
        </Text>
      </Skeleton>
    </Cell>
    <Cell $area="action" />
  </Row>
)

type CellProps = {
  $area: string
  $align?: 'start' | 'end'
  /** Shown above the value, as a phone has no header row. */
  label?: string
  children?: ReactNode
}

const Cell = ({ $area, $align, label, children }: CellProps) => (
  <CellRoot $area={$area} $align={$align}>
    {label ? <CellLabel>{label}</CellLabel> : null}
    {children}
  </CellRoot>
)

/* The card a phone gets instead of the table's columns. */
const AREAS = `
  "project project"
  "status amount"
  "issuedBy issued"
  "period period"
  "action action"
`

const Root = styled(WorkspacePage)`
  display: grid;
  align-content: start;
  gap: var(--ui-section-gap);
`

/* The status above the scope filters, both on the right; below xl they take
   the header's own row, the status first. */
const HeaderTools = styled.div`
  display: grid;
  justify-items: end;
  gap: var(--ui-space-3);
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('xl')} {
    justify-items: stretch;
  }
`

const Freshness = styled(WorkspaceFreshness)`
  ${(p) => p.theme.breakpoints.down('xl')} {
    justify-self: start;
  }
`

const Shown = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const Tools = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: end;
  gap: var(--ui-space-3);
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-auto-flow: row;
    justify-content: start;
    justify-items: start;
    width: 100%;
  }
`

const Toolbar = styled.div`
  display: grid;
  gap: var(--ui-space-4);
  min-width: 0;
`

const Content = styled.div`
  display: grid;
  gap: var(--ui-space-4);
  min-width: 0;
`

const Count = styled.span`
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

/* The panel is the surface: the cards inside part with hairlines rather
   than each wearing a border of their own. */
const List = styled.div`
  display: grid;
`

const LoadingMore = styled.div`
  display: grid;
  place-items: center;
  padding: var(--ui-space-2) 0;
`

const Sentinel = styled.div`
  height: 1px;
`

/* Positioned so ProjectLink's overlay can stretch across the whole row: the
   entire row opens the invoice, not just the title. */
const Row = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas: ${AREAS};
  align-items: start;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4) 0;
  transition: background-color var(--ui-transition);

  & + & {
    border-top: var(--ui-border-width) solid var(--ui-line);
  }
`

const CellRoot = styled.div<{ $area: string; $align?: 'start' | 'end' }>`
  grid-area: ${(p) => p.$area};
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$align === 'end' ? 'flex-end' : 'flex-start')};
  justify-content: center;
  gap: 2px;
  min-width: 0;
  text-align: ${(p) => (p.$align === 'end' ? 'right' : 'left')};

  /* A column flex item sizes to its content; the cap is what lets a long
     issuer name or project title truncate instead of overrunning the next
     column. */
  & > * {
    max-width: 100%;
  }

  /* An empty action cell costs no height on a phone. */
  &:empty {
    display: none;
  }
`

const CellLabel = styled.span`
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  color: var(--ui-muted);
`

/* One real link for the card. The overlay gives it the row's whole hit area
   while the anchor itself keeps the title as its accessible name, so the
   keyboard tab stop, the focus ring and open-in-new-tab all still work.
   Anything else clickable in the row has to sit above it - see SettleButton.
   The cost is that text inside the card can no longer be selected. */
const ProjectLink = styled(NavLink)`
  display: block;
  text-decoration: none;
  color: var(--ui-ink);
  font-weight: var(--ui-weight-semibold);
  min-width: 0;
  max-width: 100%;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  &:focus-visible {
    outline: none;
  }

  /* Inset, so the ring survives the panel clipping its rows' corners. */
  &:focus-visible::after {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: calc(-1 * var(--ui-focus-width));
    border-radius: var(--ui-row-radius);
  }

  ${Row}:hover & {
    text-decoration: underline;
  }
`

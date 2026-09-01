import { Badge, Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { $user } from '@/entities/profile'
import {
  $hasMoreInvoices,
  $invoiceProjectFilter,
  $invoiceStateFilter,
  $invoiceSummary,
  $invoiceSummaryLoading,
  $invoices,
  $invoicesTotal,
  $isLoadingMoreInvoices,
  InvoicePaymentActions,
  fetchInvoiceList,
  formatCents,
  invoiceListQuery,
  invoiceProjectFilterChanged,
  invoiceProjectsQuery,
  invoiceStateFilterChanged,
  loadMoreInvoices,
  shortenAddress,
  type InvoiceStateFilter,
} from '@/features/invoice'
import { routes } from '@/routes'
import {
  formatCurrency,
  getFriendlyWalletAddress,
  useDateFormatter,
} from '@/shared'
import {
  Button,
  PageHelmet,
  SectionTitle,
  Select,
  StatStrip,
  StatTile,
  TabsList,
  TabsRoot,
  TabsTrigger,
  Text,
  Wrapper,
  useBreakpoint,
} from '@/shared'

/** The tab values: the two server states plus "every state". */
const STATE_TABS: { value: InvoiceStateFilter; labelKey: string }[] = [
  { value: '', labelKey: 'invoices.filter.state.all' },
  { value: 'Requested', labelKey: 'invoices.filter.state.awaiting' },
  { value: 'PAID', labelKey: 'invoices.filter.state.paid' },
]

// Radix tabs need a non-empty value; "all" stands in for the empty filter.
const ALL_TAB = 'all'

/**
 * Every invoice the signed-in user can see, newest first.
 *
 * One list rather than one per project: an invoice is a money record, and the
 * question it answers - what am I owed, what have I paid - spans projects. The
 * strip at the top answers it outright; the rows are the evidence.
 */
export default function InvoicesPage() {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()
  const isDesktop = useBreakpoint('isDesktop')

  const {
    rows,
    total,
    hasMore,
    pending,
    loadingMore,
    failed,
    fetchList,
    loadMore,
    projectId,
    changeProject,
    stateFilter,
    changeState,
    summary,
    summaryLoading,
    projects,
    loadProjects,
    user,
  } = useUnit({
    rows: $invoices,
    total: $invoicesTotal,
    hasMore: $hasMoreInvoices,
    pending: invoiceListQuery.$pending,
    loadingMore: $isLoadingMoreInvoices,
    failed: invoiceListQuery.$failed,
    fetchList: fetchInvoiceList,
    loadMore: loadMoreInvoices,
    projectId: $invoiceProjectFilter,
    changeProject: invoiceProjectFilterChanged,
    stateFilter: $invoiceStateFilter,
    changeState: invoiceStateFilterChanged,
    summary: $invoiceSummary,
    summaryLoading: $invoiceSummaryLoading,
    projects: invoiceProjectsQuery.$data,
    loadProjects: invoiceProjectsQuery.start,
    user: $user,
  })

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

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

  const formatDate = (value: string | undefined) =>
    value ? dateFormatter.format(new Date(value)) : '—'

  const isFiltered = Boolean(projectId || stateFilter)
  const showSkeleton = pending && !loadingMore && rows.length === 0
  const showEmpty = !pending && !failed && rows.length === 0

  return (
    <Wrapper>
      <PageHelmet title={t('invoices.page.title')} />
      <Flex direction="column" gap="5" py="2">
        <PageHead>
          <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
            <PageTitle>{t('invoices.page.title')}</PageTitle>
            <Text size="3" color="gray">
              {t('invoices.page.description')}
            </Text>
          </Flex>
          <FilterBar>
            <Select
              options={projectOptions}
              value={projectId}
              placeholder={t('invoices.filter.allProjects')}
              onChange={(value) => {
                if (Array.isArray(value)) {
                  return
                }

                changeProject(value)
              }}
            />
          </FilterBar>
        </PageHead>
        {/* The answer to "what am I owed" before the rows that justify it. */}
        <StatStrip $columns={3}>
          <StatTile
            tone="amber"
            label={t('invoices.summary.awaiting')}
            value={formatCents(summary.requestedCents)}
            hint={t('invoices.summary.count', {
              count: summary.requestedCount,
            })}
            loading={summaryLoading}
          />
          <StatTile
            tone="green"
            label={t('invoices.summary.paid')}
            value={formatCents(summary.paidCents)}
            hint={t('invoices.summary.count', { count: summary.paidCount })}
            loading={summaryLoading}
          />
          <StatTile
            label={t('invoices.summary.total')}
            value={formatCents(summary.totalCents)}
            hint={t('invoices.summary.count', { count: summary.totalCount })}
            loading={summaryLoading}
          />
        </StatStrip>
        <Toolbar>
          <TabsRoot
            value={stateFilter || ALL_TAB}
            onValueChange={(value) =>
              changeState(
                value === ALL_TAB
                  ? ''
                  : (value as Exclude<InvoiceStateFilter, ''>),
              )
            }
          >
            <TabsList>
              {STATE_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value || ALL_TAB}
                  value={tab.value || ALL_TAB}
                >
                  {t(tab.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </TabsRoot>
          {total > 0 && !showSkeleton ? (
            <Text size="2" color="gray">
              {t('invoices.page.shownOfTotal', { shown: rows.length, total })}
            </Text>
          ) : null}
        </Toolbar>
        <List aria-label={t('invoices.page.title')} aria-busy={pending}>
          {isDesktop && (showSkeleton || rows.length > 0) ? (
            <HeadRow aria-hidden>
              <HeadCell $area="project">{t('invoices.item.project')}</HeadCell>
              <HeadCell $area="status">{t('invoices.item.status')}</HeadCell>
              <HeadCell $area="issuedBy">
                {t('invoices.item.issuedBy')}
              </HeadCell>
              <HeadCell $area="period">{t('invoices.item.period')}</HeadCell>
              <HeadCell $area="issued">{t('invoices.item.issued')}</HeadCell>
              <HeadCell $area="amount" $align="end">
                {t('invoices.item.amount')}
              </HeadCell>
              <HeadCell $area="action" />
            </HeadRow>
          ) : null}
          {showSkeleton
            ? [0, 1, 2].map((row) => <SkeletonRow key={row} />)
            : null}
          {/* A failed request is not an empty list. Saying "no invoices yet"
              when the truth is "could not load them" sends someone looking for
              an invoice they know exists. */}
          {failed ? (
            <Notice>
              <Text size="4" weight="medium">
                {t('invoices.page.error.title')}
              </Text>
              <Text size="3" color="gray">
                {t('invoices.page.error.description')}
              </Text>
              <Button size="l" variant="outline" onClick={() => fetchList()}>
                {t('invoices.page.error.retry')}
              </Button>
            </Notice>
          ) : null}
          {showEmpty ? (
            <Notice>
              <Text size="4" weight="medium">
                {t(
                  isFiltered
                    ? 'invoices.page.empty.filtered.title'
                    : 'invoices.page.empty.title',
                )}
              </Text>
              <Text size="3" color="gray">
                {t(
                  isFiltered
                    ? 'invoices.page.empty.filtered.description'
                    : 'invoices.page.empty.description',
                )}
              </Text>
              {isFiltered ? (
                <Button
                  size="l"
                  variant="outline"
                  onClick={() => {
                    changeProject('')
                    changeState('')
                  }}
                >
                  {t('invoices.page.empty.filtered.reset')}
                </Button>
              ) : null}
            </Notice>
          ) : null}
          {rows.map((invoice) => {
            const isPaid = invoice.state === 'PAID'
            // Only the issuer may settle: the person owed the money is the
            // one who knows whether it arrived.
            const canSettle = Boolean(user?.id && invoice.user?.id === user.id)
            const issuer =
              invoice.user?.name ||
              shortenAddress(
                getFriendlyWalletAddress(invoice.user?.address) ?? '',
              )

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
                    <Badge
                      size="2"
                      variant="soft"
                      color={isPaid ? 'green' : 'amber'}
                    >
                      {t(
                        isPaid
                          ? 'invoice.state.paid'
                          : 'invoice.state.requested',
                      )}
                    </Badge>
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
                  <Text size="2">
                    {formatDate(invoice.fromAt)} — {formatDate(invoice.toAt)}
                  </Text>
                </Cell>
                <Cell $area="issued" label={t('invoices.item.issued')}>
                  <Text size="2">{formatDate(invoice.createdAt)}</Text>
                </Cell>
                <Cell
                  $area="amount"
                  $align="end"
                  label={t('invoices.item.amount')}
                >
                  <Text size="4" weight="medium">
                    {formatCents(Number(invoice.amountCents ?? 0))}
                  </Text>
                  {/* The project's rate as it stands today. The amount above
                      was frozen when the invoice was raised, so editing the
                      rate afterwards leaves the two describing different
                      moments. */}
                  <Text size="1" color="gray">
                    {t('invoices.item.perHour', {
                      rate: formatCurrency(invoice.project?.rateHour),
                    })}
                  </Text>
                </Cell>
                <Cell $area="action" $align="end">
                  <InvoicePaymentActions
                    invoiceId={invoice.id as string}
                    isPaid={isPaid}
                    canSettle={canSettle}
                    stretch={!isDesktop}
                  />
                </Cell>
              </Row>
            )
          })}
        </List>
        {hasMore ? (
          <Flex direction="column" gap="2" align="center" py="2">
            <Button
              size="l"
              variant="outline"
              disabled={loadingMore}
              onClick={() => loadMore()}
            >
              {t(
                loadingMore
                  ? 'invoices.page.loadingMore'
                  : 'invoices.page.loadMore',
              )}
            </Button>
          </Flex>
        ) : null}
      </Flex>
    </Wrapper>
  )
}

/**
 * The loading state is a real row with its text covered rather than a plain
 * block, so the skeleton and the invoice that replaces it have the same height
 * and the same column positions - the list does not reflow when data lands.
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
        <Text size="2">00th Aug 0000 — 00th Aug 0000</Text>
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
  /** Shown above the value on a phone, where there is no header row. */
  label?: string
  children?: ReactNode
}

const Cell = ({ $area, $align, label, children }: CellProps) => (
  <CellRoot $area={$area} $align={$align}>
    {label ? <CellLabel>{label}</CellLabel> : null}
    {children}
  </CellRoot>
)

/* Desktop columns, and the card layout the same cells fall into on a phone. */
const COLUMNS =
  'minmax(0, 1.6fr) 150px minmax(0, 1fr) minmax(0, 1.4fr) 120px 130px 150px'
const AREAS = '"project status issuedBy period issued amount action"'
const MOBILE_AREAS = `
  "project project"
  "status amount"
  "issuedBy issued"
  "period period"
  "action action"
`

const PageTitle = styled(SectionTitle)`
  ${(p) => p.theme.breakpoints.up('md')} {
    font-size: var(--font-size-7);
  }
`

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
`

/* Title left, filter right; the filter drops under the title once the row
   runs out of width rather than squeezing the heading. */
const PageHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
`

const FilterBar = styled.div`
  display: flex;
  gap: var(--space-2);
  flex: 0 0 auto;
  width: 260px;
  max-width: 100%;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
`

const HeadRow = styled.div`
  display: grid;
  grid-template-columns: ${COLUMNS};
  grid-template-areas: ${AREAS};
  gap: var(--space-4);
  padding: 0 var(--space-4);
`

const HeadCell = styled.div<{ $area: string; $align?: 'start' | 'end' }>`
  grid-area: ${(p) => p.$area};
  font-size: var(--font-size-1);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ds-neutral-11);
  text-align: ${(p) => (p.$align === 'end' ? 'right' : 'left')};
`

/* Positioned so ProjectLink's overlay can stretch across the whole card: the
   entire row opens the invoice, not just the title. */
const Row = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: ${COLUMNS};
  grid-template-areas: ${AREAS};
  align-items: center;
  gap: var(--space-4);
  border: 1px solid var(--gray-a5);
  border-radius: var(--radius-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-panel-solid);
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--gray-a8);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: ${MOBILE_AREAS};
    align-items: start;
    gap: var(--space-3);
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
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);

  ${(p) => p.theme.breakpoints.up('md')} {
    display: none;
  }
`

const Notice = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  text-align: center;
  border: 1px dashed var(--gray-a6);
  border-radius: var(--radius-3);
`

/* One real link for the card. The overlay gives it the row's whole hit area
   while the anchor itself keeps the title as its accessible name, so the
   keyboard tab stop, the focus ring and open-in-new-tab all still work.
   Anything else clickable in the row has to sit above it - see SettleButton.
   The cost is that text inside the card can no longer be selected. */
const ProjectLink = styled(NavLink)`
  display: block;
  text-decoration: none;
  color: var(--ds-accent-11);
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

  &:focus-visible::after {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
    border-radius: var(--radius-3);
  }

  ${Row}:hover & {
    text-decoration: underline;
  }
`

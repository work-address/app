import { Badge, Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { $user } from '@/entities/profile'
import {
  $hasMoreInvoices,
  $invoiceProjectFilter,
  $invoices,
  $invoicesTotal,
  $isLoadingMoreInvoices,
  InvoicePaymentActions,
  fetchInvoiceList,
  formatCents,
  invoiceListQuery,
  invoiceProjectFilterChanged,
  invoiceProjectsQuery,
  loadMoreInvoices,
  shortenAddress,
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
  Text,
  Wrapper,
} from '@/shared'

/**
 * Every invoice the signed-in user can see, newest first.
 *
 * One list rather than one per project: an invoice is a money record, and the
 * question it answers - what am I owed, what have I paid - spans projects.
 */
export default function InvoicesPage() {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()

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

  return (
    <Wrapper>
      <PageHelmet title={t('invoices.page.title')} />
      <Flex direction="column" gap="4" py="4">
        <PageHead>
          <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
            <SectionTitle>{t('invoices.page.title')}</SectionTitle>
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
        {pending && !loadingMore && rows.length === 0 ? (
          <List aria-hidden>
            {[0, 1, 2].map((row) => (
              <SkeletonRow key={row} />
            ))}
          </List>
        ) : null}
        {/* A failed request is not an empty list. Saying "no invoices yet"
            when the truth is "could not load them" sends someone looking for
            an invoice they know exists. */}
        {failed ? (
          <Flex direction="column" gap="3" py="6" align="center">
            <Text size="4" weight="medium">
              {t('invoices.page.error.title')}
            </Text>
            <Text size="3" color="gray">
              {t('invoices.page.error.description')}
            </Text>
            <Button size="l" variant="outline" onClick={() => fetchList()}>
              {t('invoices.page.error.retry')}
            </Button>
          </Flex>
        ) : null}
        {!pending && !failed && rows.length === 0 ? (
          <Flex direction="column" gap="2" py="6" align="center">
            <Text size="4" weight="medium">
              {t('invoices.page.empty.title')}
            </Text>
            <Text size="3" color="gray">
              {t('invoices.page.empty.description')}
            </Text>
          </Flex>
        ) : null}
        {rows.length > 0 ? (
          <List aria-label={t('invoices.page.title')}>
            {rows.map((invoice) => {
              const isPaid = invoice.state === 'PAID'
              // Only the issuer may settle: the person owed the money is the
              // one who knows whether it arrived.
              const canSettle = Boolean(
                user?.id && invoice.user?.id === user.id,
              )
              const issuer =
                invoice.user?.name ||
                shortenAddress(
                  getFriendlyWalletAddress(invoice.user?.address) ?? '',
                )

              return (
                <Row key={invoice.id}>
                  <Header>
                    <Title style={{ minWidth: 0 }}>
                      {/* No "Project" label: the title is the heading of the
                          card, and labelling it read as "Project Ergonomic
                          Gold Pizza" rather than as a name. */}
                      <ProjectLink
                        to={routes.invoice.build({ id: invoice.id as string })}
                      >
                        <Text size="4" weight="medium" truncate>
                          {invoice.project?.title ?? '—'}
                        </Text>
                      </ProjectLink>
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
                    </Title>
                    <Money>
                      {/* The project's rate as it stands today. The amount
                          beside it was frozen when the invoice was raised, so
                          editing the project rate afterwards leaves the two
                          describing different moments. */}
                      <Amount
                        label={t('invoice.fields.rateHour')}
                        value={formatCurrency(invoice.project?.rateHour)}
                      />
                      <Amount
                        label={t('invoices.item.amount')}
                        value={formatCents(Number(invoice.amountCents ?? 0))}
                      />
                      <InvoicePaymentActions
                        invoiceId={invoice.id as string}
                        isPaid={isPaid}
                        // Only the issuer may settle: the person owed the
                        // money is the one who knows whether it arrived.
                        canSettle={canSettle}
                      />
                    </Money>
                  </Header>
                  {/* Several invoices can share a project and a period - one
                      per contributor - so the issuer, the dates and the
                      reference are what tell them apart in this list. A
                      wrapping run rather than fixed columns: the period is
                      three times the width of "Paid", and forcing them into
                      equal columns truncated it mid-date. */}
                  <Meta>
                    <Field label={t('invoices.item.issuedBy')} value={issuer} />
                    <Field
                      label={t('invoices.item.period')}
                      value={`${formatDate(invoice.fromAt)} — ${formatDate(
                        invoice.toAt,
                      )}`}
                    />
                    <Field
                      label={t('invoices.item.issued')}
                      value={formatDate(invoice.createdAt)}
                    />
                    {/* An em dash rather than a blank: the row keeps its shape
                        and an unsettled invoice reads as "not paid yet" rather
                        than as missing data. */}
                    <Field
                      label={t('invoices.item.paidOn')}
                      value={isPaid ? formatDate(invoice.paidAt) : '—'}
                    />
                    <Field
                      label={t('invoices.item.reference')}
                      value={shortenAddress(invoice.id ?? '')}
                    />
                  </Meta>
                </Row>
              )
            })}
          </List>
        ) : null}
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
            <Text size="2" color="gray">
              {t('invoices.page.shownOfTotal', {
                shown: rows.length,
                total,
              })}
            </Text>
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
 *
 * Built from the same Row/Header/FieldGrid components for the same reason: the
 * two cannot drift apart when the row layout changes.
 */
const SkeletonRow = () => (
  <Row>
    <Header>
      <Title>
        <Skeleton>
          <Text size="4" weight="medium">
            Project name
          </Text>
        </Skeleton>
      </Title>
      <Money>
        <Flex direction="column" gap="1" align="end">
          <Skeleton>
            <Text size="1">Rate</Text>
          </Skeleton>
          <Skeleton>
            <Text size="5" weight="bold">
              $00.00
            </Text>
          </Skeleton>
        </Flex>
        <Flex direction="column" gap="1" align="end">
          <Skeleton>
            <Text size="1">Amount</Text>
          </Skeleton>
          <Skeleton>
            <Text size="5" weight="bold">
              $0000.00
            </Text>
          </Skeleton>
        </Flex>
      </Money>
    </Header>
    <Meta>
      {SKELETON_FIELDS.map((label) => (
        <Skeleton key={label}>
          <Text size="2" weight="medium">
            {label} 00th Aug 0000
          </Text>
        </Skeleton>
      ))}
    </Meta>
  </Row>
)

/* Widths come from the labels the real row uses, so the placeholder columns
   land where the real ones will. */
const SKELETON_FIELDS = ['Issued by', 'Period', 'Issued', 'Paid', 'Reference']

/** Label beside its value, as one unbreakable unit in the meta run. */
const Field = ({ label, value }: { label: string; value: string }) => (
  <FieldRoot>
    <Text size="1" color="gray">
      {label}
    </Text>
    <Text size="2" weight="medium">
      {value}
    </Text>
  </FieldRoot>
)

/** The two money figures: label above value, right-aligned and matching. */
const Amount = ({ label, value }: { label: string; value: string }) => (
  <Flex direction="column" align="end">
    <Text size="1" color="gray">
      {label}
    </Text>
    <Text size="5" weight="medium">
      {value}
    </Text>
  </Flex>
)

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
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

/* Positioned so ProjectLink's overlay can stretch across the whole card: the
   entire row opens the invoice, not just the title. */
const Row = styled.li`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--gray-a5);
  border-radius: var(--radius-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-panel-solid);
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--gray-a8);
  }
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  min-width: 0;
`

/* Name and status read as one unit, so they stay on the same line and the
   title takes the squeeze rather than pushing the badge onto its own row. */
const Title = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1 1 auto;
`

/* Hugs the right edge even once the header wraps, so the figures stay in one
   column down the list instead of drifting under the title on a phone. */
const Money = styled.div`
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  flex: 0 0 auto;
  margin-left: auto;
`

/* One wrapping run. Fixed columns left "Paid —" holding the same width as a
   full date range, which is what made the card look half-empty. */
const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-4);
  padding-top: var(--space-2);
  border-top: 1px solid var(--gray-a4);
  min-width: 0;
`

const FieldRoot = styled.div`
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  min-width: 0;
`

/* One real link for the card. The overlay gives it the row's whole hit area
   while the anchor itself keeps the title as its accessible name, so the
   keyboard tab stop, the focus ring and open-in-new-tab all still work.
   Anything else clickable in the row has to sit above it - see SettleButton.
   The cost is that text inside the card can no longer be selected. */
const ProjectLink = styled(NavLink)`
  text-decoration: none;
  color: inherit;
  min-width: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  ${Row}:hover & {
    text-decoration: underline;
  }
`

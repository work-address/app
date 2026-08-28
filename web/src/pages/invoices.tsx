import { Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { $user } from '@/entities/profile'
import {
  InvoicePaymentActions,
  formatCents,
  invoiceListQuery,
  shortenAddress,
} from '@/features/invoice'
import { routes } from '@/routes'
import { Button, PageHelmet, SectionTitle, Text, Wrapper } from '@/shared'

/**
 * Every invoice the signed-in user can see, newest first.
 *
 * One list rather than one per project: an invoice is a money record, and the
 * question it answers - what am I owed, what have I paid - spans projects.
 */
export default function InvoicesPage() {
  const { t } = useTranslation()

  const { invoices, pending, failed, load, user } = useUnit({
    invoices: invoiceListQuery.$data,
    pending: invoiceListQuery.$pending,
    failed: invoiceListQuery.$failed,
    load: invoiceListQuery.start,
    user: $user,
  })

  useEffect(() => {
    load()
  }, [load])

  const rows = invoices ?? []

  return (
    <Wrapper>
      <PageHelmet title={t('invoices.page.title')} />
      <Flex direction="column" gap="4" py="4">
        <Flex direction="column" gap="1">
          <SectionTitle>{t('invoices.page.title')}</SectionTitle>
          <Text size="3" color="gray">
            {t('invoices.page.description')}
          </Text>
        </Flex>
        {pending && rows.length === 0 ? (
          <Flex direction="column" gap="2" aria-hidden>
            {[0, 1, 2].map((row) => (
              <Skeleton
                key={row}
                height="88px"
                style={{ borderRadius: 'var(--radius-3)' }}
              />
            ))}
          </Flex>
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
            <Button size="l" variant="outline" onClick={() => load()}>
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
          <ul
            aria-label={t('invoices.page.title')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {rows.map((invoice) => (
              <li
                key={invoice.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                  border: '1px solid var(--gray-a5)',
                  borderRadius: 'var(--radius-3)',
                  padding: 'var(--space-3)',
                }}
              >
                <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                  <NavLink
                    to={routes.invoice.build({ id: invoice.id as string })}
                  >
                    <Text size="3" weight="medium">
                      {invoice.project?.title ?? ''}
                    </Text>
                  </NavLink>
                  <Text size="2" color="gray">
                    {invoice.user?.name ||
                      shortenAddress(invoice.user?.address ?? '')}
                  </Text>
                  <Text size="2" color="gray">
                    {new Date(invoice.fromAt as string).toLocaleDateString()} —{' '}
                    {new Date(invoice.toAt as string).toLocaleDateString()}
                  </Text>
                </Flex>
                <Flex align="center" gap="4" wrap="wrap">
                  <Text size="5" weight="bold">
                    {formatCents(Number(invoice.amountCents ?? 0))}
                  </Text>
                  <InvoicePaymentActions
                    invoiceId={invoice.id as string}
                    isPaid={invoice.state === 'PAID'}
                    // Only the issuer may settle: the person owed the money is
                    // the one who knows whether it arrived.
                    canSettle={Boolean(
                      user?.id && invoice.user?.id === user.id,
                    )}
                    onChanged={load}
                  />
                </Flex>
              </li>
            ))}
          </ul>
        ) : null}
      </Flex>
    </Wrapper>
  )
}

import { Badge, Flex, Skeleton, Table } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { $balanceLoading, $transactions } from '../model'

import { BalanceSectionCard } from './balance-styles'

import type { Transaction, TransactionStatus } from '../model'

import { Text } from '@/shared'

const statusColor: Record<TransactionStatus, 'green' | 'amber' | 'red'> = {
  confirmed: 'green',
  pending: 'amber',
  failed: 'red',
}

export const BalanceTransactionsList = () => {
  const { t, i18n } = useTranslation()
  const { transactions, loading } = useUnit({
    transactions: $transactions,
    loading: $balanceLoading,
  })

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language],
  )

  return (
    <BalanceSectionCard>
      <Flex direction={'column'} gap={'4'}>
        <Text size={'4'} weight={'medium'}>
          {t('balance.transactions.title')}
        </Text>
        {loading ? (
          <Skeleton width={'100%'} height={'120px'} />
        ) : transactions.length === 0 ? (
          <Text size={'2'} color={'gray'}>
            {t('balance.transactions.empty')}
          </Text>
        ) : (
          <Table.Root variant={'surface'}>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>
                  {t('balance.transactions.head.date')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('balance.transactions.head.type')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('balance.transactions.head.amount')}
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  {t('balance.transactions.head.status')}
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  dateFormatter={dateFormatter}
                  t={t}
                />
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Flex>
    </BalanceSectionCard>
  )
}

type TransactionRowProps = {
  tx: Transaction
  dateFormatter: Intl.DateTimeFormat
  t: ReturnType<typeof useTranslation>['t']
}

const TransactionRow = ({ tx, dateFormatter, t }: TransactionRowProps) => {
  const sign = tx.type === 'topUp' ? '+' : '-'

  return (
    <Table.Row>
      <Table.Cell>
        <Text size={'2'}>{dateFormatter.format(new Date(tx.createdAt))}</Text>
      </Table.Cell>
      <Table.Cell>
        <Text size={'2'}>{t(`balance.transactions.type.${tx.type}`)}</Text>
      </Table.Cell>
      <Table.Cell>
        <Text size={'2'} weight={'medium'}>
          {sign}
          {tx.amount.toFixed(2)} {tx.currency}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Badge color={statusColor[tx.status]}>
          {t(`balance.transactions.status.${tx.status}`)}
        </Badge>
      </Table.Cell>
    </Table.Row>
  )
}

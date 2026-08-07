import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons'
import { Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { $balance, $balanceLoading } from '../model'

import { BalanceSectionCard } from './balance-styles'

import { Button, Text } from '@/shared'

type BalanceCardProps = {
  onTopUp?: () => void
  onWithdraw?: () => void
}

export const BalanceCard = ({ onTopUp, onWithdraw }: BalanceCardProps) => {
  const { t } = useTranslation()
  const { balance, loading } = useUnit({
    balance: $balance,
    loading: $balanceLoading,
  })

  const formattedAmount = balance ? balance.amount.toFixed(2) : '0.00'
  const currency = balance?.currency ?? 'USDT'

  return (
    <BalanceSectionCard>
      <Flex direction={'column'} gap={'5'}>
        <Flex direction={'column'} gap={'2'}>
          <Text size={'2'} color={'gray'}>
            {t('balance.card.subtitle')}
          </Text>
          <Skeleton loading={loading}>
            <Text size={'8'} weight={'bold'}>
              {formattedAmount} {currency}
            </Text>
          </Skeleton>
        </Flex>
        <Flex gap={'3'} wrap={'wrap'}>
          <Button onClick={onTopUp}>
            <ArrowDownIcon />
            <Text>{t('balance.card.topUp')}</Text>
          </Button>
          <Button color="neutral" variant="outline" onClick={onWithdraw}>
            <ArrowUpIcon />
            <Text>{t('balance.card.withdraw')}</Text>
          </Button>
        </Flex>
      </Flex>
    </BalanceSectionCard>
  )
}

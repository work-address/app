import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import {
  BalanceCard,
  TopUpCard,
  TopUpEthCard,
  TransactionsList,
  fetchBalance,
  resetBalance,
} from '@/features/balance'
import { routes } from '@/routes'
import { Card, IconButton, PageHelmet, Text, useBreakpoint } from '@/shared'

export default function BalancePage() {
  const { t, i18n } = useTranslation()
  const isMobile = useBreakpoint('isMobile')

  const { fetchBalanceEvent, resetBalanceEvent } = useUnit({
    fetchBalanceEvent: fetchBalance,
    resetBalanceEvent: resetBalance,
  })

  useEffect(() => {
    fetchBalanceEvent()

    return () => {
      resetBalanceEvent()
    }
  }, [fetchBalanceEvent, resetBalanceEvent])

  return (
    <>
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('balance.documentTitle')}
      />
      <CardWrapper shadow={false} as={isMobile ? 'div' : CardWrapper}>
        <Flex direction={'column'} gap={'20px'}>
          <Flex align={'center'} gap={'2'}>
            {isMobile && (
              <IconWrapper to={routes.dashboard.build()}>
                <IconButton variant={'ghost'} radius={'full'} color={'gray'}>
                  <ArrowLeftIcon />
                </IconButton>
              </IconWrapper>
            )}
            <Text size={isMobile ? '5' : '6'} weight={'medium'}>
              {t('balance.page.title')}
            </Text>
          </Flex>
          <BalanceCard />
          <TopUpCard />
          <TopUpEthCard />
          <TransactionsList />
        </Flex>
      </CardWrapper>
    </>
  )
}

const IconWrapper = styled(NavLink)`
  padding-left: var(--space-2);
`

const CardWrapper = styled(Card)`
  padding: 20px var(--space-3);

  ${(p) => p.theme.breakpoints.up('md')} {
    width: 1196px;
    margin: var(--space-5) auto;
  }
`

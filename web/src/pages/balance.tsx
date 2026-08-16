import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import {
  BalanceCard,
  BalanceTopUpCard,
  BalanceTopUpEthCard,
  BalanceTransactionsList,
  fetchBalance,
  resetBalance,
} from '@/features/balance'
import { routes } from '@/routes'
import {
  IconButton,
  PageHelmet,
  Text,
  useBreakpoint,
  WidePageCard,
} from '@/shared'

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
      <Root shadow={false} as={isMobile ? 'div' : Root}>
        <Flex direction={'column'} gap={'20px'}>
          <Flex align={'center'} gap={'2'}>
            {isMobile && (
              <BackLink to={routes.dashboard.build()}>
                <IconButton variant={'ghost'} radius={'full'} color={'gray'}>
                  <ArrowLeftIcon />
                </IconButton>
              </BackLink>
            )}
            <Text size={isMobile ? '5' : '6'} weight={'medium'}>
              {t('balance.page.title')}
            </Text>
          </Flex>
          <BalanceCard />
          <BalanceTopUpCard />
          <BalanceTopUpEthCard />
          <BalanceTransactionsList />
        </Flex>
      </Root>
    </>
  )
}

const BackLink = styled(NavLink)`
  padding-left: var(--space-2);
`

const Root = WidePageCard

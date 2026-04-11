import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Flex, Separator } from '@radix-ui/themes'
import { NavLink } from 'react-router-dom'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import {
  InvoiceCard,
  TotalAmountDesktop,
  TotalAmountMobile,
  Worklogs,
} from '@/features/invoice'
import { Card, IconButton, routes, Text } from '@/features/shared'

export default function InvoicePage() {
  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))

  return (
    <CardWrapper shadow={false} as={isMobile ? 'div' : CardWrapper}>
      <Flex direction={'column'} gap={'20px'}>
        {isMobile && (
          <Flex gap={'2'} direction={'column'}>
            <Flex direction={'column'}>
              <IconWrapper to={routes.dashboard.schema}>
                <IconButton variant={'ghost'} radius={'full'} color={'gray'}>
                  <ArrowLeftIcon />
                </IconButton>
              </IconWrapper>

              <Text>Project 1</Text>
            </Flex>

            <Text color={'gray'} size={'2'}>
              0:6a5b9c7e2f3d4e5f6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9
            </Text>
          </Flex>
        )}

        {isMobile ? (
          <InvoiceCard shadow={false}>
            <TotalAmountMobile />
          </InvoiceCard>
        ) : (
          <TotalAmountDesktop />
        )}

        {!isMobile && (
          <>
            <Separator size={'4'} />
            <Separator size={'4'} />
          </>
        )}

        <Worklogs />
      </Flex>
    </CardWrapper>
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

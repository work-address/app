import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Flex, Separator } from '@radix-ui/themes'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))

  return (
    <>
      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('app.documentTitle.invoice')}
      />
      <CardWrapper shadow={false} as={isMobile ? 'div' : CardWrapper}>
        <Flex direction={'column'} gap={'20px'}>
          {isMobile && (
            <Flex gap={'2'} direction={'column'}>
              <Flex direction={'column'}>
                <IconWrapper>
                  <IconButton variant={'ghost'} radius={'full'} color={'gray'}>
                    <ArrowLeftIcon />
                  </IconButton>
                </IconWrapper>

                <Text>{t('invoice.mock.projectName')}</Text>
              </Flex>

              <Text color={'gray'} size={'2'}>
                {t('invoice.mock.hashPrefixed')}
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

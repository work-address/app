import { Cross1Icon, StarFilledIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $user } from '@/entities/profile'
import { Button, IconButton, Text, showToast, useBreakpoint } from '@/shared'

const DISMISSED_KEY = 'dashboard_premium_banner_dismissed'

export const DashboardPremiumBanner = () => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const user = useUnit($user)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1',
  )

  if (user?.premium || dismissed) {
    return null
  }

  const handleUpgradeClick = () => {
    showToast('info', {
      message: t('dashboard.premiumBanner.comingSoon'),
      position: 'top-center',
    })
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <Root align={isDesktop ? 'center' : 'flex-start'}>
      <IconWrap>
        <StarFilledIcon width={18} height={18} />
      </IconWrap>
      <Body>
        <Text weight={'medium'} size={'3'}>
          {t('dashboard.premiumBanner.title')}
        </Text>
        <Text size={'2'} color={'gray'}>
          {t('dashboard.premiumBanner.description')}
        </Text>
      </Body>
      <Button size={isDesktop ? 'l' : 'm'} onClick={handleUpgradeClick}>
        {t('dashboard.premiumBanner.cta')}
      </Button>
      <DismissButton
        variant="ghost"
        color="gray"
        radius="full"
        size="1"
        aria-label={t('dashboard.premiumBanner.dismissAlt')}
        onClick={handleDismiss}
      >
        <Cross1Icon />
      </DismissButton>
    </Root>
  )
}

const Root = styled.div<{ align: 'center' | 'flex-start' }>`
  position: relative;
  display: flex;
  align-items: ${(p) => p.align};
  gap: 16px;
  padding: 16px 44px 16px 20px;
  margin-bottom: 20px;
  border-radius: var(--radius-4);
  border: 1px solid var(--ds-accent-alpha-6);
  background: var(--ds-accent-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-direction: column;
    align-items: stretch;
  }
`

const IconWrap = styled.div`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--white);
  color: var(--ds-accent-9);

  ${(p) => p.theme.breakpoints.down('md')} {
    display: none;
  }
`

const Body = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: 1;
  text-align: left;
`

const DismissButton = styled(IconButton)`
  position: absolute;
  top: 10px;
  right: 10px;
`

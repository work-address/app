import { Cross1Icon, StarFilledIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $premiumBannerCollapsed,
  togglePremiumBanner,
} from '../../model/premium-banner'

import { $user } from '@/entities/profile'
import {
  Button,
  FREE_RETENTION_DAYS,
  IconButton,
  Text,
  billingUrl,
  useBreakpoint,
} from '@/shared'

export const DashboardPremiumBanner = () => {
  const { t, i18n } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const { user, collapsed, toggleCollapsed } = useUnit({
    user: $user,
    collapsed: $premiumBannerCollapsed,
    toggleCollapsed: togglePremiumBanner,
  })

  if (user?.premium) {
    return null
  }

  // Collapsed, the banner lives in the header as PremiumCollapsedButton so it
  // stays reachable from every screen rather than only this one.
  if (collapsed) {
    return null
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
          {t('dashboard.premiumBanner.description', {
            days: FREE_RETENTION_DAYS,
          })}
        </Text>
      </Body>
      {/* Billing lives on the marketing site, so this leaves the app. `noopener`
          because `target=_blank` otherwise hands the new tab a reference back
          to this window. */}
      <UpgradeLink
        href={billingUrl(i18n.language)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button size={isDesktop ? 'l' : 'm'}>
          {t('dashboard.premiumBanner.cta')}
        </Button>
      </UpgradeLink>
      <DismissButton
        variant="ghost"
        color="gray"
        radius="full"
        size="1"
        aria-label={t('dashboard.premiumBanner.dismissAlt')}
        onClick={toggleCollapsed}
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

const UpgradeLink = styled.a`
  text-decoration: none;
`

const DismissButton = styled(IconButton)`
  position: absolute;
  top: 10px;
  right: 10px;
`

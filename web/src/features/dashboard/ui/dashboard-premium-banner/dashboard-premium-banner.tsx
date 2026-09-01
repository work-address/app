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
  Tooltip,
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

  // Dismissing hides the promo for good; the header carries a NoPremiumBadge
  // as the persistent status indicator, so nothing is lost by collapsing it.
  if (collapsed) {
    return null
  }

  return (
    <Root align={isDesktop ? 'center' : 'flex-start'}>
      <Body>
        <TitleRow>
          <IconWrap>
            <StarFilledIcon width={14} height={14} />
          </IconWrap>
          <Text weight={'medium'} size={'2'}>
            {t('dashboard.premiumBanner.title')}
          </Text>
        </TitleRow>
        <Text size={'1'} color={'gray'}>
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
        <Button size={isDesktop ? 'm' : 's'}>
          {t('dashboard.premiumBanner.cta')}
        </Button>
      </UpgradeLink>
      <Tooltip content={t('dashboard.premiumBanner.dismissHint')}>
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
      </Tooltip>
    </Root>
  )
}

const Root = styled.div<{ align: 'center' | 'flex-start' }>`
  position: relative;
  display: flex;
  align-items: ${(p) => p.align};
  gap: 12px;
  padding: 8px 34px 8px 12px;
  margin-bottom: 12px;
  border-radius: var(--radius-4);
  border: 1px solid var(--ds-accent-alpha-6);
  background: var(--ds-accent-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-direction: column;
    align-items: stretch;
  }
`

const IconWrap = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  color: var(--ds-accent-9);
`

const TitleRow = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
`

const Body = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  flex: 1;
  text-align: left;

  /*
   * Radix sets line-height on .rt-Text itself at (0,1,0), which a single
   * styled-components class only ties - the winner would then come down to
   * injection order. && doubles the class to (0,2,0) so this reliably wins.
   * Unitless on purpose: --line-height-N is calc(Npx * var(--scaling)), so a
   * hardcoded px value would silently stop responding to --scaling.
   */
  && * {
    line-height: 1.3;
  }
`

const UpgradeLink = styled.a`
  text-decoration: none;
`

const DismissButton = styled(IconButton)`
  position: absolute;
  top: 5px;
  right: 5px;
`

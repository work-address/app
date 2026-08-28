import { StarFilledIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $premiumBannerCollapsed,
  togglePremiumBanner,
} from '../model/premium-banner'

import { $user } from '@/entities/profile'
import { Tooltip } from '@/shared'

/**
 * The collapsed premium banner, as a chip beside the profile button.
 *
 * Lives in the header rather than the dashboard body so it stays reachable
 * from every screen - a dismissed banner that only reappears on the dashboard
 * is effectively gone. Renders nothing for premium accounts, and nothing while
 * the full banner is expanded.
 */
export const PremiumCollapsedButton = () => {
  const { t } = useTranslation()

  const { user, collapsed, toggle } = useUnit({
    user: $user,
    collapsed: $premiumBannerCollapsed,
    toggle: togglePremiumBanner,
  })

  if (user?.premium || !collapsed) {
    return null
  }

  return (
    <Tooltip content={t('dashboard.premiumBanner.expandAlt')}>
      <Root
        type="button"
        aria-label={t('dashboard.premiumBanner.expandAlt')}
        onClick={() => toggle()}
      >
        <StarFilledIcon width={16} height={16} />
      </Root>
    </Tooltip>
  )
}

const Root = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 40px, not the 32px this had in the dashboard flow: it now sits in a row of
     header controls and has to be a comfortable tap target. */
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: 1px solid var(--ds-accent-alpha-6);
  border-radius: 50%;
  background: var(--ds-accent-3);
  color: var(--ds-accent-9);
  cursor: pointer;

  &:hover {
    background: var(--ds-accent-4);
  }
`

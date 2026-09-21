import { ClockIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { premiumState } from '../../model/premium-state'
import {
  formatRotationDate,
  retentionNoticeDue,
} from '../../model/retention-notice'
import {
  $retentionNotice,
  fetchRetentionNoticeFx,
} from '../../model/retention-notice-store'

import { $user } from '@/entities/profile'
import { Text, billingUrl } from '@/shared'

/**
 * Tells a free owner what leaves their history, and when, before it goes
 * (DEC-05). Separate from the premium banner on purpose: the banner is an
 * offer and can be dismissed for good, while this is notice of a removal and
 * stays for as long as something is due.
 */
export const DashboardRetentionNotice = () => {
  const { t, i18n } = useTranslation()
  const { user, notice, load } = useUnit({
    user: $user,
    notice: $retentionNotice,
    load: fetchRetentionNoticeFx,
  })
  const state = premiumState(user)

  useEffect(() => {
    if (state === 'free') {
      // A failed load leaves the last notice in place; see the store.
      load().catch(() => {})
    }
  }, [state, load])

  if (!retentionNoticeDue(notice, state)) {
    return null
  }

  return (
    <Root role="status">
      <IconWrap>
        <ClockIcon width={14} height={14} />
      </IconWrap>
      <Body>
        <Text weight={'medium'} size={'2'}>
          {t('dashboard.retentionNotice.title', {
            date: formatRotationDate(notice.rotatesAt, i18n.language),
            count: notice.count,
          })}
        </Text>
        <Text size={'1'} color={'gray'}>
          {t('dashboard.retentionNotice.description', {
            days: notice.windowDays,
          })}{' '}
          <UpgradeLink
            href={billingUrl(i18n.language)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('dashboard.retentionNotice.cta')}
          </UpgradeLink>
        </Text>
      </Body>
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: var(--radius-4);
  border: 1px solid var(--ds-amber-alpha-6);
  background: var(--ds-amber-2);
`

const IconWrap = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  padding-top: 3px;
  color: var(--ds-amber-11);
`

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`

const UpgradeLink = styled.a`
  color: var(--ds-accent-11);
  text-decoration: underline;
`

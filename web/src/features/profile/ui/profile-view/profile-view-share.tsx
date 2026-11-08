import {
  ArrowRightIcon,
  GlobeIcon,
  Link2Icon,
  Share1Icon,
} from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { $isAuthenticatedUserProfile, $profileLoading } from '../../model'

import { ProfileViewSection } from './profile-view-section'

import { routes } from '@/routes'
import { Button } from '@/shared'

const ICON_SIZE = 16

/** An invitation to pass the profile on, with the page's own share action. */
export const ProfileViewShare = ({ onShare }: { onShare: () => void }) => {
  const { t } = useTranslation()
  const { isOwn, loading } = useUnit({
    isOwn: $isAuthenticatedUserProfile,
    loading: $profileLoading,
  })

  // Written to the owner; a visitor has the header's Share.
  if (!isOwn || loading) {
    return null
  }

  return (
    <ProfileViewSection>
      <Row>
        <Icon>
          <Link2Icon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
        </Icon>
        <Body>
          <Title>{t('profile.view.shareCard.title')}</Title>
          <Text>{t('profile.view.shareCard.description')}</Text>
          <Action>
            <Button
              variant="outline"
              color="neutral"
              iconLeft={<Share1Icon />}
              onClick={onShare}
            >
              {t('profile.view.shareProfile')}
            </Button>
          </Action>
        </Body>
      </Row>
    </ProfileViewSection>
  )
}

/** For the owner only: what visitors see, and where to change it. */
export const ProfileViewVisibility = () => {
  const { t } = useTranslation()
  const { isOwn, loading } = useUnit({
    isOwn: $isAuthenticatedUserProfile,
    loading: $profileLoading,
  })

  if (!isOwn || loading) {
    return null
  }

  return (
    <ProfileViewSection>
      <GlobeIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
      <Title>{t('profile.view.visibility.title')}</Title>
      <Text>{t('profile.view.visibility.description')}</Text>
      <Manage to={routes.settings.build()}>
        {t('profile.view.visibility.manage')}
        <ArrowRightIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
      </Manage>
    </ProfileViewSection>
  )
}

const Row = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-space-3);
`

const Icon = styled.span`
  display: grid;
  place-items: center;
  width: var(--ui-control-height);
  height: var(--ui-control-height);
  border-radius: var(--ui-control-radius);
  background: var(--ui-inset);
  color: var(--ui-blue);
`

const Body = styled.div`
  display: grid;
  gap: var(--ui-space-1);
  min-width: 0;
`

const Title = styled.p`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
`

const Text = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const Action = styled.div`
  margin-top: var(--ui-space-2);
`

const Manage = styled(Link)`
  display: inline-grid;
  grid-auto-flow: column;
  justify-self: start;
  align-items: center;
  gap: var(--ui-space-1);
  border-radius: var(--ui-inline-radius);
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`

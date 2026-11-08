import { ArrowRightIcon, GlobeIcon } from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { type Control, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import type { ProfileEditFormState } from './profile-edit-field'

import { routes } from '@/routes'
import { formatRate, getCountryLabel, WorkspaceSheet } from '@/shared'

type Props = {
  control: Control<ProfileEditFormState>
  profileId?: string
  loading: boolean
  className?: string
}

const ICON_SIZE = 16

/** Up to two letters for the stand-in avatar; no picture is implied. */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

/**
 * How the public profile will read, from the unsaved draft: it follows each
 * keystroke and saves nothing.
 */
export const ProfileEditPreview = ({
  control,
  profileId,
  loading,
  className,
}: Props) => {
  const { t, i18n } = useTranslation()
  const [name, title, city, country, rate] = useWatch({
    control,
    name: ['name', 'title', 'city', 'country', 'rate'],
  })

  const location = [
    city,
    getCountryLabel(country, i18n.resolvedLanguage ?? i18n.language),
  ]
    .filter(Boolean)
    .join(', ')
  const hasRate = Number(String(rate ?? '').replace(',', '.')) > 0
  const initials = initialsOf(name ?? '')

  return (
    <Root className={className}>
      <Card aria-label={t('settings.preview.title')}>
        <Caption>{t('settings.preview.title')}</Caption>
        <Skeleton loading={loading}>
          <Identity>
            {initials ? <Avatar aria-hidden>{initials}</Avatar> : null}
            <Name>{name || t('settings.preview.unnamed')}</Name>
            {title ? <Title>{title}</Title> : null}
            {location ? <Meta>{location}</Meta> : null}
          </Identity>
        </Skeleton>
        <Rate>
          {hasRate ? (
            <>
              <RateValue>
                {formatRate(Number(String(rate).replace(',', '.')))}
              </RateValue>
              <Meta>{t('profile.view.usdtUnit')}</Meta>
            </>
          ) : (
            <Meta>{t('profile.view.rateUnset')}</Meta>
          )}
        </Rate>
        {profileId ? (
          <ViewLink to={routes.profile.build({ id: profileId })}>
            {t('settings.preview.view')}
            <ArrowRightIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
          </ViewLink>
        ) : null}
      </Card>
      <Card>
        <TipIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
        <TipTitle>{t('settings.preview.tipTitle')}</TipTitle>
        <Meta>{t('settings.preview.tip')}</Meta>
      </Card>
    </Root>
  )
}

const Root = styled.aside`
  display: grid;
  align-content: start;
  gap: var(--ui-section-gap);
  min-width: 0;
`

const Card = styled(WorkspaceSheet)`
  gap: var(--ui-space-3);
`

const Caption = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
  font-weight: var(--ui-eyebrow-weight);
  letter-spacing: var(--ui-eyebrow-tracking);
  text-transform: uppercase;
`

const Identity = styled.div`
  display: grid;
  justify-items: center;
  gap: var(--ui-space-1);
  padding-block: var(--ui-space-2);
  text-align: center;
`

const Avatar = styled.span`
  display: grid;
  place-items: center;
  width: var(--ui-space-9);
  height: var(--ui-space-9);
  margin-bottom: var(--ui-space-2);
  border-radius: var(--ui-control-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
  font-size: var(--ui-metric-min-size);
  font-weight: var(--ui-weight-semibold);
  box-shadow: var(--ui-shadow);
`

const Name = styled.p`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-figure-size);
  line-height: var(--ui-figure-line-height);
  font-weight: var(--ui-heading-weight);
  overflow-wrap: anywhere;
`

const Title = styled.p`
  margin: 0;
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
`

const Meta = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
`

const Rate = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: center;
  align-items: baseline;
  gap: var(--ui-space-2);
  padding-top: var(--ui-space-3);
  border-top: var(--ui-border-width) solid var(--ui-line);
`

const RateValue = styled.span`
  color: var(--ui-ink);
  font-size: var(--ui-figure-size);
  line-height: var(--ui-figure-line-height);
  font-weight: var(--ui-weight-semibold);
  font-variant-numeric: tabular-nums;
`

const ViewLink = styled(Link)`
  display: inline-grid;
  grid-auto-flow: column;
  justify-self: center;
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

const TipIcon = styled(GlobeIcon)`
  color: var(--ui-blue);
`

const TipTitle = styled.p`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
`

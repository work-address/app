import { CopyIcon, Pencil1Icon, Share1Icon } from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  $isAuthenticatedUserProfile,
  $profile,
  $profileLoading,
} from '../../model'

import { ProfileViewQrCode } from './profile-view-qr-code'
import { ProfileViewSection } from './profile-view-section'

import { LocalWalletRevealButton } from '@/features/local-wallet'
import { routes } from '@/routes'
import {
  Button,
  formatAddress,
  formatCurrency,
  getCountryLabel,
  IconButton,
  PremiumBadge,
  Tooltip,
  useBreakpoint,
  WorkspacePageHeader,
} from '@/shared'

type Props = {
  onWalletAddressCopy: () => void
  onShareProfile: () => void
}

/**
 * The page heading with what can be done with the profile, then who this is
 * and what they charge, on one white sheet.
 */
export const ProfileViewHead = ({
  onWalletAddressCopy,
  onShareProfile,
}: Props) => {
  const { t, i18n } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const navigate = useNavigate()

  const { user, loading, isOwn } = useUnit({
    user: $profile,
    loading: $profileLoading,
    isOwn: $isAuthenticatedUserProfile,
  })

  const name = user?.name || user?.title
  const jobTitle = user?.title && user.title !== name ? user.title : null
  const shortAddress = user?.address ? formatAddress(user.address) : null
  const isPremium = Boolean(user && 'premium' in user && user.premium)
  // A rate of zero is an unset rate, not a free service: "$0.00 per hour" on a
  // profile reads as a broken page.
  const hasRate = Number(user?.rate ?? 0) > 0
  const hasQrCode = Boolean(user?.payWallet) || loading
  const location = [
    user?.city,
    getCountryLabel(user?.country, i18n.resolvedLanguage ?? i18n.language),
  ]
    .filter(Boolean)
    .join(', ')
  const facts = [location, user?.company].filter(Boolean).join(' · ')

  const copyLabel = t('profile.view.copyAddressHint')

  return (
    <>
      <WorkspacePageHeader
        // While the profile loads, the owner's lines hold their place so the
        // page does not shift down when they arrive.
        eyebrow={
          isOwn ? (
            t('profile.page.eyebrow')
          ) : loading ? (
            <Skeleton width="200px" height="14px" />
          ) : undefined
        }
        title={t('header.nav.profile')}
        description={
          isOwn ? (
            t('profile.page.description')
          ) : loading ? (
            <Skeleton width="320px" height="20px" />
          ) : undefined
        }
        actions={
          <Actions>
            {isOwn && (
              <LocalWalletRevealButton
                address={user?.connectedWallet ?? user?.address}
                stretch={isMobile}
              />
            )}
            <Button
              variant="outline"
              color="neutral"
              stretch={isMobile}
              iconLeft={<Share1Icon />}
              onClick={onShareProfile}
            >
              {t('common.share')}
            </Button>
            {isOwn && (
              <Button
                stretch={isMobile}
                iconLeft={<Pencil1Icon />}
                onClick={() =>
                  navigate(
                    routes.profile.children.edit.build({ id: user?.id ?? '' }),
                    { viewTransition: true },
                  )
                }
              >
                {t('common.edit')}
              </Button>
            )}
          </Actions>
        }
      />
      <ProfileViewSection>
        <Root data-qr={hasQrCode || undefined}>
          {hasQrCode && <QrCode />}
          <Identity>
            {loading ? (
              <Skeleton width="220px" height="32px" />
            ) : (
              <NameRow>
                {/* With no name the address is what names the profile, and
                    it is then only said once, here. */}
                <Name>{name || shortAddress}</Name>
                {!name && shortAddress && (
                  <Tooltip content={copyLabel}>
                    <IconButton
                      variant="ghost"
                      radius="full"
                      color="gray"
                      aria-label={copyLabel}
                      onClick={onWalletAddressCopy}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                )}
                {isPremium && <PremiumBadge />}
              </NameRow>
            )}
            {jobTitle && <JobTitle>{jobTitle}</JobTitle>}
            {facts && <Facts>{facts}</Facts>}
            {loading ? (
              <Skeleton width="150px" height="20px" />
            ) : (
              name &&
              shortAddress && (
                <Tooltip content={copyLabel}>
                  <AddressButton
                    type="button"
                    aria-label={copyLabel}
                    onClick={onWalletAddressCopy}
                  >
                    {shortAddress}
                    <CopyIcon aria-hidden />
                  </AddressButton>
                </Tooltip>
              )
            )}
          </Identity>
          <Rate>
            {hasRate || loading ? (
              <>
                <Skeleton loading={loading}>
                  <RateValue>{formatCurrency(user?.rate)}</RateValue>
                </Skeleton>
                <RateUnit>{t('profile.view.usdtUnit')}</RateUnit>
              </>
            ) : (
              <RateUnit>{t('profile.view.rateUnset')}</RateUnit>
            )}
          </Rate>
        </Root>
      </ProfileViewSection>
    </>
  )
}

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: end;
  gap: var(--ui-space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-auto-columns: minmax(0, 1fr);
    justify-content: stretch;
  }
`

const Root = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'identity rate';
  align-items: center;
  gap: var(--ui-space-4) var(--ui-section-gap);

  &[data-qr] {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'qr identity rate';
  }

  /* Narrow: the code stays beside the name, the rate takes its own line. */
  @container (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'identity'
      'rate';

    &[data-qr] {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        'identity qr'
        'rate rate';
    }
  }
`

const QrCode = styled(ProfileViewQrCode)`
  grid-area: qr;
`

const Identity = styled.div`
  grid-area: identity;
  display: grid;
  justify-items: start;
  gap: var(--ui-space-1);
  min-width: 0;
`

const NameRow = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: var(--ui-space-2);
  min-width: 0;
`

const Name = styled.h2`
  margin: 0;
  min-width: 0;
  color: var(--ui-ink);
  font-size: var(--ui-metric-min-size);
  line-height: var(--ui-heading-line-height);
  font-weight: var(--ui-title-weight);
  letter-spacing: var(--ui-heading-tracking);
  overflow-wrap: anywhere;
`

const JobTitle = styled.p`
  margin: 0;
  color: var(--ui-text);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  overflow-wrap: anywhere;
`

const Facts = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
`

/* A link in all but tag: a bare line of text with a copy icon, on the column's
   own left edge rather than inset by a button's padding. */
const AddressButton = styled.button`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--ui-space-1);
  margin-top: var(--ui-space-1);
  padding: 0;
  border: 0;
  border-radius: var(--ui-inline-radius);
  background: none;
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`

/* The rate, set off from the identity by a rule, as the sheet's headline
   figure. */
const Rate = styled.div`
  grid-area: rate;
  display: grid;
  justify-items: end;
  align-content: center;
  gap: var(--ui-space-1);
  padding-inline-start: var(--ui-section-gap);
  border-inline-start: var(--ui-border-width) solid var(--ui-line);

  @container (max-width: 720px) {
    justify-items: start;
    padding-inline-start: 0;
    padding-top: var(--ui-space-4);
    border-inline-start: 0;
    border-top: var(--ui-border-width) solid var(--ui-line);
  }
`

const RateValue = styled.span`
  color: var(--ui-ink);
  font-size: var(--ui-metric-size);
  line-height: var(--ui-metric-line-height);
  font-weight: var(--ui-metric-weight);
  letter-spacing: var(--ui-metric-tracking);
  font-variant-numeric: tabular-nums;

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-metric-min-size);
  }
`

const RateUnit = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

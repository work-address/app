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
  IconButton,
  PageTitle,
  PremiumBadge,
  Text,
  Tooltip,
  useBreakpoint,
} from '@/shared'

type Props = {
  onWalletAddressCopy: () => void
  onShareProfile: () => void
}

/** Who this is, what they charge, and what can be done with the profile. */
export const ProfileViewHead = ({
  onWalletAddressCopy,
  onShareProfile,
}: Props) => {
  const { t } = useTranslation()
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

  const copyLabel = t('profile.view.copyAddressHint')

  return (
    <ProfileViewSection>
      <Root data-qr={hasQrCode || undefined}>
        {hasQrCode && <QrCode />}
        <Identity>
          {loading ? (
            <Skeleton width="220px" height="35px" />
          ) : (
            <TitleRow>
              {/* With no name the address is what names the profile, and it
                  is then only said once, here. */}
              <PageTitle>{name || shortAddress}</PageTitle>
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
            </TitleRow>
          )}
          {jobTitle && (
            <Text color="gray" size={{ initial: '2', md: '3' }}>
              {jobTitle}
            </Text>
          )}
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
                  <Text $themeVariant="primary" size="2" weight="medium">
                    {shortAddress}
                  </Text>
                  <CopyIcon />
                </AddressButton>
              </Tooltip>
            )
          )}
        </Identity>
        <Side>
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
              onClick={onShareProfile}
            >
              {t('common.share')}
              <Share1Icon />
            </Button>
            {isOwn && (
              <Button
                stretch={isMobile}
                onClick={() =>
                  navigate(
                    routes.profile.children.edit.build({ id: user?.id ?? '' }),
                    { viewTransition: true },
                  )
                }
              >
                {t('common.edit')}
                <Pencil1Icon />
              </Button>
            )}
          </Actions>
          {hasRate || loading ? (
            <Rate>
              <Skeleton loading={loading}>
                <Text
                  $themeVariant="primary"
                  size={{ initial: '5', md: '6' }}
                  weight="medium"
                >
                  {formatCurrency(user?.rate)}
                </Text>
              </Skeleton>
              <Text $themeVariant="primary" size="2">
                {t('profile.view.usdtUnit')}
              </Text>
            </Rate>
          ) : (
            <Text color="gray" size="2">
              {t('profile.view.rateUnset')}
            </Text>
          )}
        </Side>
      </Root>
    </ProfileViewSection>
  )
}

const QrCode = styled(ProfileViewQrCode)`
  grid-area: qr;
`

const Root = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'identity side';
  align-items: center;
  gap: var(--space-4) var(--space-5);

  &[data-qr] {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'qr identity side';
  }

  /* The QR code keeps beside the name when narrow, where it would otherwise
     cost a screenful; the buttons and the rate get the full width below. */
  @container (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'identity'
      'side';

    &[data-qr] {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        'identity qr'
        'side side';
    }
  }
`

const Identity = styled.div`
  grid-area: identity;
  display: grid;
  justify-items: start;
  gap: var(--space-1);
  min-width: 0;
`

const TitleRow = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: auto;
  justify-content: start;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
`

/* A link in all but tag: a bare line of text with a copy icon, on the column's
   own left edge rather than inset by a button's padding. */
const AddressButton = styled.button`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  background: none;
  color: var(--ds-neutral-11);
  cursor: pointer;
  border-radius: var(--radius-1);

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }
`

const Side = styled.div`
  grid-area: side;
  display: grid;
  justify-items: end;
  gap: var(--space-2);
  min-width: 0;

  @container (max-width: 720px) {
    justify-items: start;
    gap: var(--space-3);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    justify-items: stretch;
  }
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-2);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-auto-columns: minmax(0, 1fr);
  }
`

const Rate = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: baseline;
  gap: var(--space-1);
`

import { Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profile } from '../../model'

import { ProfileViewDescriptionAndSkills } from './profile-view-description-and-skills'
import { ProfileViewLinks } from './profile-view-links'
import { ProfileViewQrCode } from './profile-view-qr-code'

import {
  formatWalletAddress,
  showToast,
  copyToClipboard,
  useBreakpoint,
  Wrapper,
} from '@/shared'

export const ProfileView = () => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const { user } = useUnit({ user: $profile })

  // The cards show the name as the page's h1. A profile without one still
  // needs a heading for screen readers, and the address is what names it.
  const unnamedTitle =
    user && !(user.name || user.title) && user.friendlyWalletAddress ? (
      <HiddenTitle>
        {formatWalletAddress(user.friendlyWalletAddress)}
      </HiddenTitle>
    ) : null

  const handleCopyWalletAddress = () => {
    copyToClipboard(user?.friendlyWalletAddress || '').then(() => {
      showToast('info', {
        message: t('profile.view.addressCopied'),
        position: 'top-center',
      })
    })
  }

  const handleShareProfile = () => {
    copyToClipboard(window.location.href).then(() => {
      showToast('info', {
        message: t('profile.view.profileLinkCopied'),
        position: 'top-center',
      })
    })
  }

  // A plain stack on a phone rather than the named-area grid: the links card
  // renders nothing there when the profile has no links, and an empty named
  // area still costs a row plus its gaps. In a stack a missing card costs
  // nothing.
  if (!isDesktop) {
    return (
      <Root>
        {unnamedTitle}
        <Stack>
          <ProfileViewQrCode
            onWalletAddressCopy={handleCopyWalletAddress}
            onShareProfile={handleShareProfile}
          />
          <ProfileViewLinks
            onWalletAddressCopy={handleCopyWalletAddress}
            onShareProfile={handleShareProfile}
          />
          <ProfileViewDescriptionAndSkills />
        </Stack>
      </Root>
    )
  }

  return (
    <Root>
      {unnamedTitle}
      <Grid
        areas={{
          initial: `
          "qrcode profile"
          "description description"
        `,
        }}
        /* The QR card keeps its square; the profile card takes the rest of
           the reading column every document page shares. */
        columns={{
          initial: 'minmax(0, 246px) minmax(0, 1fr)',
        }}
        rows={{
          initial: `auto auto`,
        }}
        gap={{
          initial: '20px',
        }}
      >
        <ProfileViewQrCode
          gridArea={'qrcode'}
          onWalletAddressCopy={handleCopyWalletAddress}
          onShareProfile={handleShareProfile}
        />
        <ProfileViewLinks
          gridArea={'profile'}
          onWalletAddressCopy={handleCopyWalletAddress}
          onShareProfile={handleShareProfile}
        />
        <ProfileViewDescriptionAndSkills gridArea={'description'} />
      </Grid>
    </Root>
  )
}

/* The document column every record page shares, so the profile, its edit
   form and an invoice start at the same place. */
const Root = styled(Wrapper).attrs({ width: 'document' as const })``

const Stack = styled.div`
  display: grid;
  gap: var(--space-3);
`

const HiddenTitle = styled.h1`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`

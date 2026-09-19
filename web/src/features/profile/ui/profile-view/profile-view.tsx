import { Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profile } from '../../model'

import { ProfileViewDescriptionAndSkills } from './profile-view-description-and-skills'
import { ProfileViewHiddenNotice } from './profile-view-hidden-notice'
import { ProfileViewLinks } from './profile-view-links'
import { ProfileViewQrCode } from './profile-view-qr-code'

import { showToast, copyToClipboard, useBreakpoint } from '@/shared'

export const ProfileView = () => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const { user } = useUnit({ user: $profile })

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
        <Stack>
          <ProfileViewHiddenNotice />
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
      <HiddenNotice />
      <Grid
        areas={{
          initial: `
          "qrcode profile"
          "description description"
        `,
        }}
        /* Capped, not fixed: 246 + 668 + the gap is 934px, which is wider
           than a tablet in portrait or a large phone on its side. Fixed
           tracks there hung the cards off both edges of the screen. */
        columns={{
          initial: 'minmax(0, 246px) minmax(0, 668px)',
        }}
        rows={{
          initial: `auto auto`,
        }}
        gap={{
          initial: '20px',
        }}
        justify={{
          initial: 'center',
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

const Root = styled.div`
  padding: 24px;

  /* The same inset as the other pages' Wrapper, so the cards line up with
     the dashboard and the invoices list when switching between tabs. */
  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 18px 16px 24px;
  }
`

/* Lined up with the cards below it: the grid centres a 914px-wide track
   pair, so the notice takes the same width and centre. */
const HiddenNotice = styled(ProfileViewHiddenNotice)`
  max-width: 934px;
  margin: 0 auto 20px;
`

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
`

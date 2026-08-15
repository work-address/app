import { Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profile } from '../../model'

import { ProfileViewDescriptionAndSkills } from './profile-view-description-and-skills'
import { ProfileViewLinks } from './profile-view-links'
import { ProfileViewQrCode } from './profile-view-qr-code'

import { showToast, copyToClipboard } from '@/shared'

export const ProfileView = () => {
  const { t } = useTranslation()
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

  return (
    <Root>
      <Grid
        areas={{
          initial: `
          "qrcode"
          "profile"
          "description"
        `,
          md: `
          "qrcode profile"
          "description description"
        `,
        }}
        columns={{
          initial: '1fr',
          md: '246px 668px',
        }}
        rows={{
          initial: 'auto auto auto',
          md: `auto auto`,
        }}
        gap={{
          initial: '0',
          sm: '20px',
        }}
        justify={{
          md: 'center',
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
`

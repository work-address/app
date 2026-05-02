import { Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import styled from 'styled-components'

import { $profile } from '../../model'

import { DescriptionAndSkills } from './description-and-skills.tsx'
import { ProfileLinks } from './profile-links.tsx'
import { QrCode } from './qr-code.tsx'

import { showToast, copyToClipboard } from '@/shared'

export const ProfileView = () => {
  const { user } = useUnit({ user: $profile })

  const handleCopyWalletAddress = () => {
    copyToClipboard(user?.friendlyWalletAddress || '').then(() => {
      showToast('info', {
        message: 'Address copied to clipboard',
        position: 'top-center',
      })
    })
  }

  const handleShareProfile = () => {
    copyToClipboard(window.location.href).then(() => {
      showToast('info', {
        message: 'Profile link copied to clipboard',
        position: 'top-center',
      })
    })
  }

  return (
    <Wrapper>
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
        <QrCode
          gridArea={'qrcode'}
          onWalletAddressCopy={handleCopyWalletAddress}
          onShareProfile={handleShareProfile}
        />

        <ProfileLinks
          gridArea={'profile'}
          onWalletAddressCopy={handleCopyWalletAddress}
        />

        <DescriptionAndSkills gridArea={'description'} />
      </Grid>
    </Wrapper>
  )
}

const Wrapper = styled.div`
  padding: 24px;
`

import { Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import styled from 'styled-components'

import { $profile } from '../../model'

import { DescriptionAndSkills } from './description-and-skills.tsx'
import { ProfileLinks } from './profile-links.tsx'
import { QrCode } from './qr-code.tsx'

import { showToast } from '@/shared'

export const ProfileView = () => {
  const { user } = useUnit({ user: $profile })

  const handleCopyWalletAddress = async () => {
    await navigator.clipboard.writeText(user?.friendlyWalletAddress || '')

    showToast('info', {
      message: 'Address copied to clipboard',
      position: 'top-center',
    })
  }

  const handleShareProfile = async () => {
    await navigator.clipboard.writeText(window.location.href)

    showToast('info', {
      message: 'Profile link copied to clipboard',
      position: 'top-center',
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
          md: '20px',
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

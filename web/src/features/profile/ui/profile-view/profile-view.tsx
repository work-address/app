import { useUnit } from 'effector-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profile } from '../../model'

import { ProfileViewDescriptionAndSkills } from './profile-view-description-and-skills'
import { ProfileViewHead } from './profile-view-head'
import { ProfileViewLinks } from './profile-view-links'
import { PROFILE_VIEW_REVEAL_LIST } from './profile-view-section'

import { copyToClipboard, showToast, Wrapper } from '@/shared'

export const ProfileView = () => {
  const { t } = useTranslation()
  const user = useUnit($profile)

  const handleCopyWalletAddress = () => {
    copyToClipboard(user?.address || '').then(() => {
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
    <Wrapper>
      <Sections
        initial="hidden"
        animate="shown"
        variants={PROFILE_VIEW_REVEAL_LIST}
      >
        <ProfileViewHead
          onWalletAddressCopy={handleCopyWalletAddress}
          onShareProfile={handleShareProfile}
        />
        <ProfileViewLinks />
        <ProfileViewDescriptionAndSkills />
      </Sections>
    </Wrapper>
  )
}

/* The bands lay out by the page's own width: with the sidebar open a small
   desktop has less room than a phone-width rule would ever notice. */
const Sections = styled(motion.div)`
  container-type: inline-size;
  display: grid;
  min-width: 0;
`

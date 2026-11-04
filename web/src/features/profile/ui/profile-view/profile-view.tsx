import { useUnit } from 'effector-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profile } from '../../model'

import { ProfileViewDescriptionAndSkills } from './profile-view-description-and-skills'
import { ProfileViewHead } from './profile-view-head'
import { ProfileViewLinks } from './profile-view-links'
import { PROFILE_VIEW_REVEAL_LIST } from './profile-view-section'

import { Card, copyToClipboard, showToast, Wrapper } from '@/shared'

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
    <Root>
      <ProfileCard>
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
      </ProfileCard>
    </Root>
  )
}

/* The document column the record pages share, so the profile and its edit
   form start at the same place. */
const Root = styled(Wrapper).attrs({ width: 'document' as const })``

/* One card with one edge, set like the edit form's. On a phone the card is
   the page, as that form's are: the sheet already insets by the gutter. */
const ProfileCard = styled(Card)`
  /* The bands lay out by the card's own width: with the sidebar open a small
     desktop has less room than a phone-width rule would ever notice. */
  container-type: inline-size;
  padding: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    &[data-shadow] {
      box-shadow: none;
    }
  }
`

const Sections = styled(motion.div)`
  display: grid;
  min-width: 0;
`

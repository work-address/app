import { useUnit } from 'effector-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profile } from '../../model'

import { ProfileViewDescriptionAndSkills } from './profile-view-description-and-skills'
import { ProfileViewHead } from './profile-view-head'
import { ProfileViewLinks } from './profile-view-links'
import { PROFILE_VIEW_REVEAL_LIST } from './profile-view-section'
import { ProfileViewShare, ProfileViewVisibility } from './profile-view-share'

import { copyToClipboard, showToast, workspaceDesign, Wrapper } from '@/shared'

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
        <Columns>
          <Column>
            <ProfileViewDescriptionAndSkills />
            <ProfileViewShare onShare={handleShareProfile} />
          </Column>
          <Column>
            <ProfileViewLinks />
            <ProfileViewVisibility />
          </Column>
        </Columns>
      </Sections>
    </Wrapper>
  )
}

/* The bands lay out by the page's own width: with the sidebar open a small
   desktop has less room than a phone-width rule would ever notice. */
/* The introduction beside the ways to reach the person; one column when the
   page is narrow, and the full width for whichever is alone. */
const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-section-gap);

  @container (min-width: ${workspaceDesign.container.roomy}px) {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);

    /* A column with nothing to show gives the other the full width. */
    &:has(> :empty) {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`

const Column = styled.div`
  display: grid;
  align-content: start;
  gap: var(--ui-section-gap);
  min-width: 0;

  &:empty {
    display: none;
  }
`

const Sections = styled(motion.div)`
  container-type: inline-size;
  display: grid;
  gap: var(--ui-section-gap);
  min-width: 0;
`

import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $isOwnProfileHidden } from '../../model'

import { Text } from '@/shared'

type Props = {
  className?: string
}

/**
 * Tells the holder that the profile they are looking at is one nobody else
 * can open. Renders nothing for anyone else, and for a visible profile.
 */
export const ProfileViewHiddenNotice = ({ className }: Props) => {
  const { t } = useTranslation()
  const isOwnProfileHidden = useUnit($isOwnProfileHidden)

  if (!isOwnProfileHidden) {
    return null
  }

  return (
    <Root className={className} role="status">
      <Text size={'2'}>{t('profile.view.hiddenNotice')}</Text>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-3);
  background-color: var(--ds-neutral-alpha-3);
`

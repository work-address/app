import { StarFilledIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Tooltip } from './tooltip'

type PremiumBadgeProps = {
  className?: string
}

export const PremiumBadge = ({ className }: PremiumBadgeProps) => {
  const { t } = useTranslation()

  return (
    <Tooltip content={t('common.premium')}>
      <Root
        className={className}
        role="img"
        aria-label={t('common.premium')}
        tabIndex={0}
      >
        <StarFilledIcon width={14} height={14} />
      </Root>
    </Tooltip>
  )
}

const Root = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--ds-accent-9);

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
    border-radius: 50%;
  }
`

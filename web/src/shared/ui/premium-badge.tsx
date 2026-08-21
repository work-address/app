import { StarFilledIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

type PremiumBadgeProps = {
  className?: string
}

export const PremiumBadge = ({ className }: PremiumBadgeProps) => {
  const { t } = useTranslation()

  return (
    <Root className={className} role="img" aria-label={t('common.premium')}>
      <StarFilledIcon width={14} height={14} />
    </Root>
  )
}

const Root = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--ds-accent-9);
`

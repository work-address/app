import { useTranslation } from 'react-i18next'
import { LuSparkles } from 'react-icons/lu'
import styled from 'styled-components'

type PremiumBadgeProps = {
  className?: string
}

export const PremiumBadge = ({ className }: PremiumBadgeProps) => {
  const { t } = useTranslation()

  return (
    <Root className={className}>
      <LuSparkles size={14} aria-hidden />
      {t('common.premium')}
    </Root>
  )
}

const Root = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1) var(--ui-space-2);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
  font-weight: var(--ui-weight-medium);
  white-space: nowrap;
`

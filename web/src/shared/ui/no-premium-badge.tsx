import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { MouseEvent } from 'react'

type NoPremiumBadgeProps = {
  className?: string
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

/**
 * The counterpart to PremiumBadge, shown when an account has no subscription.
 *
 * Rendered as a button when given an `onClick` so it can bring the dismissed
 * premium banner back, and as a plain span otherwise - a badge that does
 * nothing should not be focusable or announced as interactive.
 */
export const NoPremiumBadge = ({ className, onClick }: NoPremiumBadgeProps) => {
  const { t } = useTranslation()
  const label = t('common.noPremium')

  if (!onClick) {
    return <Root className={className}>{label}</Root>
  }

  return (
    <Root
      as="button"
      type="button"
      className={className}
      title={t('common.noPremiumAction')}
      aria-label={t('common.noPremiumAction')}
      onClick={onClick}
    >
      {label}
    </Root>
  )
}

const Root = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 2px 8px;
  border: 0;
  border-radius: 4px;
  font-family: inherit;
  font-size: 11px;
  /* line-height: 16px; */
  font-weight: 500;
  white-space: nowrap;
  /* --ds-neutral-4, not -3: the scale defines 2, 4, 11 and 12, and an
     undefined custom property resolves to nothing, leaving the pill with no
     surface at all. */
  background: var(--ds-neutral-4);
  color: var(--ds-neutral-11);

  &:is(button) {
    cursor: pointer;
    /* Above the stretched profile link that covers the card, so the click
       reaches the badge rather than navigating to the profile. */
    position: relative;
    z-index: 1;
  }

  &:is(button):hover {
    background: var(--ds-neutral-alpha-6);
  }

  &:is(button):focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }
`

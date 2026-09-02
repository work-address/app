import { ChevronRightIcon } from '@radix-ui/react-icons'
import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  iconUrl?: string
  iconAlt?: string
  /** Drawn in the mark's slot when the option has no network logo. */
  icon?: ReactNode
  children: string
  onClick?: () => void
  onMouseEnter?: () => void
  onFocus?: () => void
}

/**
 * One sign-in option. Laid out like a form's primary control - full width,
 * one row, a leading network mark - so the three of them read as the choice
 * the page is asking for rather than as a list of logos.
 */
export const AuthProviderButton = ({
  children,
  iconAlt,
  iconUrl,
  icon,
  onClick,
  onMouseEnter,
  onFocus,
}: Props) => {
  return (
    <Button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      type={'button'}
    >
      {iconUrl ? (
        <Icon src={iconUrl} alt={iconAlt ?? ''} />
      ) : (
        <IconSlot aria-hidden="true">{icon}</IconSlot>
      )}
      <Text>{children}</Text>
      <Chevron aria-hidden="true" />
    </Button>
  )
}

export const Button = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 52px;
  padding: 0 14px 0 12px;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: 8px;
  background: var(--white);
  color: var(--ds-neutral-12);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: var(--ds-accent-9);
    background: var(--ds-accent-3);
  }

  &:active {
    background: var(--ds-accent-alpha-6);
  }

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }

  &:hover svg,
  &:focus-visible svg {
    color: var(--ds-accent-11);
    transform: translateX(2px);
  }
`

export const Icon = styled.img`
  width: 28px;
  height: 28px;
  display: block;
  flex-shrink: 0;
`

const IconSlot = styled.span`
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ds-accent-3);
  color: var(--ds-accent-11);
`

export const Text = styled.span`
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-3);
  line-height: 1.3;
  font-weight: 500;
  color: inherit;
`

const Chevron = styled(ChevronRightIcon)`
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: var(--ds-neutral-11);
  transition:
    color 0.15s ease,
    transform 0.15s ease;
`

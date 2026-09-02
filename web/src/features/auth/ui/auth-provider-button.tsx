import { ChevronRightIcon } from '@radix-ui/react-icons'
import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  iconUrl?: string
  iconAlt?: string
  /** Drawn in the mark's slot when the option has no network logo. */
  icon?: ReactNode
  /**
   * `primary` paints the option in the brand blue: the one choice the page
   * recommends to someone with no wallet app, set apart from the networks.
   */
  variant?: 'default' | 'primary'
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
  variant = 'default',
  onClick,
  onMouseEnter,
  onFocus,
}: Props) => {
  return (
    <Button
      data-variant={variant}
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
      <Chevron aria-hidden="true" data-chevron />
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

  /* Only the trailing chevron nudges on hover; the leading mark stays put. */
  &:hover [data-chevron],
  &:focus-visible [data-chevron] {
    color: var(--ds-accent-11);
    transform: translateX(2px);
  }

  &[data-variant='primary'] {
    border-color: var(--ds-accent-11);
    background: var(--ds-accent-11);
    color: var(--white);
    box-shadow: 0 6px 16px -8px var(--c-rgba-63-103-164-0_25);

    &:hover {
      border-color: var(--ds-accent-9);
      background: var(--ds-accent-9);
    }

    &:active {
      background: var(--accent-10);
    }

    & [data-chevron],
    &:hover [data-chevron],
    &:focus-visible [data-chevron] {
      color: var(--white);
    }
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

  [data-variant='primary'] > & {
    background: var(--c-rgba-255-255-255-0_2);
    color: var(--white);
  }
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

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
}: Props) => {
  return (
    <Button data-variant={variant} onClick={onClick} type={'button'}>
      {iconUrl ? (
        <Icon src={iconUrl} alt={iconAlt ?? ''} aria-hidden="true" />
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
  border: 1px solid var(--ui-line);
  border-radius: 8px;
  background: var(--ui-surface);
  color: var(--ui-ink);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: var(--ui-blue);
    background: var(--ui-glow);
  }

  &:active {
    background: var(--ui-alpha-6);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-blue);
    outline-offset: 2px;
  }

  /* Only the trailing chevron nudges on hover; the leading mark stays put. */
  &:hover [data-chevron],
  &:focus-visible [data-chevron] {
    color: var(--ui-blue);
    transform: translateX(2px);
  }

  &[data-variant='primary'] {
    border-color: var(--ui-blue);
    background: var(--ui-blue);
    color: var(--ui-surface);
    box-shadow: var(--ui-shadow);

    &:hover {
      border-color: var(--ui-blue);
      background: var(--ui-blue);
    }

    &:active {
      filter: brightness(0.92);
    }

    & [data-chevron],
    &:hover [data-chevron],
    &:focus-visible [data-chevron] {
      color: var(--ui-surface);
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
  background: var(--ui-glow);
  color: var(--ui-blue);

  [data-variant='primary'] > & {
    background: color-mix(in srgb, var(--ui-surface) 20%, transparent);
    color: var(--ui-surface);
  }
`

export const Text = styled.span`
  flex: 1;
  min-width: 0;
  font-size: var(--ui-body-size);
  line-height: 1.3;
  font-weight: 500;
  color: inherit;
`

const Chevron = styled(ChevronRightIcon)`
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: var(--ui-muted);
  transition:
    color 0.15s ease,
    transform 0.15s ease;
`

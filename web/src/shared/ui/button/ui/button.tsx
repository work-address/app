import styled, { css } from 'styled-components'

import { Spinner } from '../../spinner-ring'
import {
  BUTTON_COLORS,
  BUTTON_DEFAULTS,
  BUTTON_SIZE_SPECS,
  BUTTON_SIZES,
  BUTTON_SPINNER_SIZE,
  BUTTON_TONE_SPECS,
  BUTTON_VARIANTS,
} from '../model'

import type { ButtonColor, ButtonSize, ButtonVariant } from '../model'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonProps = {
  size?: ButtonSize
  variant?: ButtonVariant
  color?: ButtonColor
  iconLeft?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
  stretch?: boolean
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>

export const Button = ({
  size = BUTTON_DEFAULTS.size,
  variant = BUTTON_DEFAULTS.variant,
  color = BUTTON_DEFAULTS.color,
  iconLeft,
  iconRight,
  loading = false,
  stretch = false,
  type = BUTTON_DEFAULTS.type,
  disabled,
  children,
  ...rest
}: ButtonProps) => {
  const isDisabled = disabled || loading
  const showIconLeft = loading || Boolean(iconLeft)
  const showIconRight = !loading && Boolean(iconRight)

  return (
    <Root
      data-size={size}
      data-variant={variant}
      data-color={color}
      data-stretch={stretch || undefined}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {showIconLeft && (
        <Icon>
          {loading ? (
            <Spinner
              size={BUTTON_SPINNER_SIZE[size]}
              width="2px"
              color={variant === 'solid' ? 'var(--white)' : 'currentColor'}
            />
          ) : (
            iconLeft
          )}
        </Icon>
      )}
      {children}
      {showIconRight && <Icon>{iconRight}</Icon>}
    </Root>
  )
}

const Icon = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
`

// The attribute selectors only assign custom properties, never real
// declarations. A `styled(Button)` wrapper is a single class (0,1,0) and would
// be outranked by `[data-size]`/`[data-color][data-variant]` selectors, so the
// declarations below have to stay in the base block to remain overridable.
const sizeAttributeStyles = css`
  ${BUTTON_SIZES.map((size) => {
    const spec = BUTTON_SIZE_SPECS[size]

    return css`
      &[data-size='${size}'] {
        --ds-button-height: ${spec.height};
        --ds-button-padding: ${spec.padding};
        --ds-button-gap: ${spec.gap};
        --ds-button-font-size: ${spec.fontSize};
        --ds-button-radius: ${spec.borderRadius};
      }
    `
  })}
`

const colorAttributeStyles = css`
  ${BUTTON_COLORS.flatMap((color) =>
    BUTTON_VARIANTS.map((variant) => {
      const tone = BUTTON_TONE_SPECS[color][variant]

      return css`
        &[data-color='${color}'][data-variant='${variant}'] {
          --ds-button-background: ${tone.background};
          --ds-button-color: ${tone.color};
          ${tone.borderColor &&
          `--ds-button-border-color: ${tone.borderColor};`}
          ${tone.hover.background &&
          `--ds-button-hover-background: ${tone.hover.background};`}
          ${tone.hover.filter &&
          `--ds-button-hover-filter: ${tone.hover.filter};`}
        }
      `
    }),
  )}
`

const Root = styled.button`
  ${sizeAttributeStyles}
  ${colorAttributeStyles}

  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    filter 0.15s ease;

  /* Content taller than the nominal size grows the button instead of
     overflowing it, e.g. the avatar block in the header user menu. */
  min-height: var(--ds-button-height);
  padding: var(--ds-button-padding);
  gap: var(--ds-button-gap);
  font-size: var(--ds-button-font-size);
  border-radius: var(--ds-button-radius);
  background: var(--ds-button-background);
  color: var(--ds-button-color);
  border: 1px solid var(--ds-button-border-color, transparent);

  &:hover:not(:disabled) {
    background: var(--ds-button-hover-background, var(--ds-button-background));
    filter: var(--ds-button-hover-filter, none);
  }

  /* A press reads as a press: a shade darker than hover, and no lag. */
  &:active:not(:disabled) {
    filter: brightness(0.9);
    transition-duration: 0s;
  }

  /* Solid enough to find with the eye: the earlier 26% ring vanished against
     the soft surfaces most of these buttons sit on. */
  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &[data-stretch] {
    width: 100%;
  }
`

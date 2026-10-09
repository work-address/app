import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { BUTTON_DEFAULTS } from '../model'

import { buttonStyles } from './button'

import type { ButtonColor, ButtonSize, ButtonVariant } from '../model'
import type { LinkProps } from 'react-router-dom'

export type LinkButtonProps = Omit<LinkProps, 'color'> & {
  size?: ButtonSize
  variant?: ButtonVariant
  color?: ButtonColor
  stretch?: boolean
}

/** Navigation with the same presentation as an action, through one anchor. */
export const LinkButton = ({
  size = BUTTON_DEFAULTS.size,
  variant = BUTTON_DEFAULTS.variant,
  color = BUTTON_DEFAULTS.color,
  stretch = false,
  ...props
}: LinkButtonProps) => (
  <Root
    {...props}
    data-size={size}
    data-variant={variant}
    data-color={color}
    data-stretch={stretch || undefined}
  />
)

const Root = styled(Link)`
  ${buttonStyles}
  text-decoration: none;
`

import { IconButton as RadixIconButton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { IconButtonProps as RadixIconButtonProps } from '@radix-ui/themes'

type IconButtonProps = {
  themeVariant?: 'primary' | 'secondary'
} & RadixIconButtonProps

export const IconButton = ({
  themeVariant,
  type = 'button',
  ...props
}: IconButtonProps) => {
  return (
    <Root
      data-theme-variant={themeVariant}
      $variant={props.variant}
      type={type}
      {...props}
    />
  )
}

// Radix's IconButton doesn't reflect `variant` as a DOM attribute (only
// `data-disabled`/`data-accent-color`/`data-radius`), so it can't be
// selected in CSS and has to stay a prop interpolation.
const Root = styled(RadixIconButton)<{ $variant?: IconButtonProps['variant'] }>`
  cursor: pointer;

  &[data-theme-variant='primary'] {
    ${(p) =>
      p.$variant === 'ghost'
        ? `color: var(--ds-accent-11);`
        : `background-color: var(--ds-accent-9);`}
  }
`

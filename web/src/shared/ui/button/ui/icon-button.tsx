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
    <StyledRadixIconButton
      $themeVariant={themeVariant}
      type={type}
      {...props}
    />
  )
}

const StyledRadixIconButton = styled(RadixIconButton)<
  {
    $themeVariant?: IconButtonProps['themeVariant']
  } & Omit<IconButtonProps, 'themeVariant'>
>`
  cursor: pointer;

  ${(p) =>
    p.$themeVariant === 'primary' &&
    p.variant !== 'ghost' &&
    `
      background-color: var(--ds-accent-9);
  `}

  ${(p) =>
    p.$themeVariant === 'primary' &&
    p.variant === 'ghost' &&
    `
    color: var(--ds-accent-11);
  `}
`

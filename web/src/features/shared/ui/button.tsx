import { Button as RadixButton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { ButtonProps as RadixButtonProps } from '@radix-ui/themes'

export type ButtonProps = {
  themeVariant?: 'primary' | 'secondary'
  stretch?: boolean
  width?: string
} & RadixButtonProps

export const Button = ({
  children,
  themeVariant,
  width,
  stretch,
  type = 'button',
  ...props
}: ButtonProps) => {
  return (
    <StyledRadixButton
      $themeVariant={themeVariant}
      $width={width}
      $stretch={stretch}
      type={type}
      {...props}
    >
      {children}
    </StyledRadixButton>
  )
}

const StyledRadixButton = styled(RadixButton)<{
  $width?: string
  $themeVariant?: ButtonProps['themeVariant']
  $stretch?: boolean
}>`
  cursor: pointer;

  &:disabled {
    opacity: 0.68;
  }

  ${(p) => p.$width !== undefined && `width: ${p.$width};`}

  ${(p) =>
    p.$themeVariant === 'primary' &&
    `
      background-color: var(--ds-accent-11);
      color: var(--white);
    `}

  ${(p) =>
    p.$themeVariant === 'secondary' &&
    `
      background-color: var(--ds-secondary);
      color: var(--ds-neutral-11);
  `}

  ${(p) =>
    p.$themeVariant === 'secondary' &&
    p.variant === 'outline' &&
    `
    box-shadow: inset 0 0 0 1px var(--gray-7);
    background-color: transparent;
  `}

  ${(p) => p.$stretch && `width: 100%;`}
`

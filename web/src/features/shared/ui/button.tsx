import { Button as RadixButton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { ButtonProps as RadixButtonProps } from '@radix-ui/themes'

export type ButtonProps = {
  themeVariant?: 'primary' | 'secondary'
  stretch?: boolean
} & Omit<RadixButtonProps, 'variant'>

export const Button = ({
  children,
  type = 'button',
  ...props
}: ButtonProps) => {
  return (
    <StyledRadixButton type={type} {...props}>
      {children}
    </StyledRadixButton>
  )
}

const StyledRadixButton = styled(RadixButton)<ButtonProps>`
  cursor: pointer;

  ${(p) =>
    p.themeVariant === 'primary' &&
    `
      background-color: var(--ds-accent-11);
      color: var(--white);
    `}

  ${(p) =>
    p.themeVariant === 'secondary' &&
    `
      background-color: var(--ds-secondary);
      color: var(--ds-neutral-11);
  `}

  ${(p) => p.stretch && `width: 100%`}

  &:disabled {
    opacity: 0.68;
  }
`

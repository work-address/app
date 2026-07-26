import { Button as RadixButton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { ButtonProps as RadixButtonProps } from '@radix-ui/themes'

export type ButtonProps = {
  themeVariant?: 'primary' | 'secondary' | 'danger'
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
    p.variant !== 'outline' &&
    `
      background-color: var(--ds-secondary);
      color: var(--ds-neutral-11);
  `}

  ${(p) =>
    p.$themeVariant === 'secondary' &&
    p.variant === 'outline' &&
    `
    --accent-a8: var(--ds-neutral-alpha-8);
    --accent-a11: var(--ds-neutral-11);
  `}

  ${(p) =>
    p.$themeVariant === 'danger' &&
    `
      background-color: var(--ds-secondary);
      color: var(--error-11);
    `}

  ${(p) => p.$stretch && `width: 100%;`}
`

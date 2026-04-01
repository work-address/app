import styled from 'styled-components'

import type React from 'react'

type ButtonVariant = 'primary' | 'secondary'

type ButtonProps = {
  variant?: ButtonVariant
} & React.ButtonHTMLAttributes<HTMLButtonElement>

const BaseButton = styled.button<{ $variant: ButtonVariant }>`
  height: 35px;
  padding: 6px 14px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  line-height: 143%;
  font-weight: 500;
  border: 1px solid transparent;

  color: ${(p) => (p.$variant === 'primary' ? '#fff' : '#3F67A4')};
  background: ${(p) => (p.$variant === 'primary' ? '#3F67A4' : 'transparent')};
  border-color: ${(p) =>
    p.$variant === 'primary' ? 'transparent' : 'rgba(0, 8, 48, 0.18)'};

  &:hover {
    filter: brightness(0.98);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const IconWrap = styled.span`
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  & > svg {
    width: 18px;
    height: 18px;
  }
`

export default function Button({
  variant = 'primary',
  children,
  ...props
}: ButtonProps) {
  return (
    <BaseButton $variant={variant} {...props}>
      {children}
    </BaseButton>
  )
}

export { IconWrap }

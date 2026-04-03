import type { ButtonProps as Work AddressButtonProps } from '@/features/shared'

import { Button as Work AddressButton } from '@/features/shared'

export interface ButtonProps extends Work AddressButtonProps {}

/** Primary UI component for user interaction */
export const Button = ({ children = 'Button', ...props }: ButtonProps) => {
  return (
    <Work AddressButton themeVariant="button" {...props}>
      {children}
    </Work AddressButton>
  )
}

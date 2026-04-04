import type { ButtonProps as Work AddressButtonProps } from '@/features/shared'

import { Button as Work AddressButton } from '@/features/shared'

export interface ButtonProps extends Work AddressButtonProps {}

/** Primary UI component for user interaction */
export const Button = ({ children = 'Button', ...props }: ButtonProps) => {
  return (
    <Work AddressButton type="button" {...props}>
      {children}
    </Work AddressButton>
  )
}

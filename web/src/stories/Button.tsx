import type { ButtonProps as Work AddressButtonProps } from '@/shared'

import { Button as Work AddressButton } from '@/shared'

export interface ButtonProps extends Work AddressButtonProps {}

/** Primary UI component for user interaction */
export const Button = ({ children = 'Button', ...props }: ButtonProps) => {
  return (
    <Work AddressButton type="button" {...props}>
      {children}
    </Work AddressButton>
  )
}

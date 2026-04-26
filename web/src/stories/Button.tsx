import type { ButtonProps as SharedButtonProps } from '@/shared'

import { Button as SharedButton } from '@/shared'

export interface ButtonProps extends SharedButtonProps {}

/** Primary UI component for user interaction */
export const Button = ({ children = 'Button', ...props }: ButtonProps) => {
  return (
    <SharedButton type="button" {...props}>
      {children}
    </SharedButton>
  )
}

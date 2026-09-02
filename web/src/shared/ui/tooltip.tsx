import { Tooltip as RadixTooltip } from '@radix-ui/themes'
import { forwardRef, type ReactElement } from 'react'

import type { TooltipProps as RadixTooltipProps } from '@radix-ui/themes'

export type TooltipProps = Omit<RadixTooltipProps, 'children'> & {
  children: ReactElement
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ delayDuration = 300, children, ...props }, ref) => {
    return (
      <RadixTooltip delayDuration={delayDuration} ref={ref} {...props}>
        {children}
      </RadixTooltip>
    )
  },
)

Tooltip.displayName = 'Tooltip'

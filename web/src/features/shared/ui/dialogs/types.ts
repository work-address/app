import type { ReactNode } from 'react'

export type CommonDialogProps = {
  children: ReactNode
  trigger?: ReactNode
  open?: boolean
  title?: ReactNode
  description?: ReactNode
  onOpenChange?: (open: boolean) => void
  desktopWidth?: string
  mobileHeight?: string
}

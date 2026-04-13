import type { ReactNode } from 'react'

export type CommonDialogProps = {
  children: ReactNode
  trigger?: ReactNode
  open?: boolean
  title?: ReactNode
  description?: ReactNode
  onOpenChange?: (open: boolean) => void
  mobileHeight?: string
  desktopWidth?: string
  desktopPadding?: string
  desktopShowClose?: boolean
}

export type ModalProps = {
  width?: string
  padding?: string
  showClose?: boolean
  showTitleSeparator?: boolean
}

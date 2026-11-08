import type { ReactNode } from 'react'

// The standard width for a single-column form dialog (create/edit modals).
// Dialogs with materially different content (e.g. a two-column layout) size
// themselves independently rather than using this.
export const DIALOG_WIDTH_STANDARD = '600px'

// For dialogs that put a chart or a second panel beside their content.
export const DIALOG_WIDTH_WIDE = '920px'

export type CommonDialogProps = {
  children: ReactNode
  trigger?: ReactNode
  open?: boolean
  title?: ReactNode
  headerActions?: ReactNode
  footer?: ReactNode
  description?: ReactNode
  onOpenChange?: (open: boolean) => void
  mobileHeight?: string
  desktopWidth?: string
  desktopPadding?: string
  desktopShowClose?: boolean
  /**
   * Focus the dialog itself on open rather than its first control, for a
   * dialog whose first control is a tooltipped icon (its tooltip would open
   * with the dialog). Tab still reaches every control in order.
   */
  focusContentOnOpen?: boolean
}

export type ModalProps = {
  width?: string
  padding?: string
  showClose?: boolean
  showTitleSeparator?: boolean
}

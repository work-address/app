import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import { Drawer } from './drawer'
import { Modal } from './modal'

import type { CommonDialogProps } from '../model'

export { Modal } from './modal'
export { Drawer } from './drawer'

export const AdaptiveDialog = ({
  desktopPadding,
  desktopShowClose,
  desktopWidth,
  ...props
}: CommonDialogProps) => {
  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))

  return isMobile ? (
    <Drawer {...props} />
  ) : (
    <Modal
      width={desktopWidth}
      showClose={desktopShowClose}
      padding={desktopPadding}
      {...props}
    />
  )
}

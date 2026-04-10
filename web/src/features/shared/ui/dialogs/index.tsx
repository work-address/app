import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import { Drawer } from './drawer.tsx'
import { Modal } from './modal.tsx'

import type { CommonDialogProps } from './types.ts'

export const AdaptiveDialog = (props: CommonDialogProps) => {
  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))

  return isMobile ? <Drawer {...props} /> : <Modal {...props} />
}

export { Modal } from './modal.tsx'
export { Drawer } from './drawer.tsx'

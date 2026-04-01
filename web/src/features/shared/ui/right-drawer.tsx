import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import styled from 'styled-components'

import type { ReactNode } from 'react'

type RightDrawerProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
}

export const RightDrawer = ({
  open,
  onClose,
  children,
  width = 420,
}: RightDrawerProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null
      if (!t) {
        return
      }
      if (!panelRef.current) {
        return
      }
      if (!panelRef.current.contains(t)) {
        onClose()
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <Stage
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <Panel
            ref={panelRef}
            style={{ width }}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </Panel>
        </Stage>
      ) : null}
    </AnimatePresence>
  )
}

const Stage = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 8, 48, 0.27);
  display: flex;
  justify-content: flex-end;
`

const Panel = styled(motion.aside)`
  height: 100vh;
  background: #fff;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 1px 4px 0 rgba(0, 0, 45, 0.09),
    0 2px 1px -1px rgba(0, 0, 0, 0.05),
    0 1px 3px 0 rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
`

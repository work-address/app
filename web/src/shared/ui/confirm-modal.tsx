import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import styled from 'styled-components'

import { Button } from './button.tsx'

type ConfirmModalProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null
      if (!t) {
        return
      }
      if (!boxRef.current) {
        return
      }
      if (!boxRef.current.contains(t)) {
        onCancel()
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open ? (
        <Stage
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <Box
            ref={boxRef}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <Title>{title}</Title>
            <Desc>{description}</Desc>
            <Btns>
              <CancelButton themeVariant="secondary" onClick={onCancel}>
                {cancelLabel}
              </CancelButton>
              <DangerBtn type="button" onClick={onConfirm}>
                {confirmLabel}
              </DangerBtn>
            </Btns>
          </Box>
        </Stage>
      ) : null}
    </AnimatePresence>
  )
}

const Stage = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 250;
  background: rgba(0, 8, 48, 0.27);
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    padding: 16px;
  }
`

const Box = styled(motion.div)`
  width: min(420px, 100%);
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 4px 0 rgba(0, 0, 45, 0.09), 0 2px 1px -1px rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.05);

  @media (max-width: 768px) {
    width: 100%;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }
`

const Title = styled.div`
  font-weight: 500;
  font-size: 20px;
  line-height: 140%;
  letter-spacing: 0em;
  color: #1c2024;
  margin-bottom: 12px;

  @media (max-width: 768px) {
    font-size: 16px;
    margin-bottom: 5px;
  }
`

const Desc = styled.div`
  font-weight: 400;
  font-size: 16px;
  line-height: 143%;
  color: #1c2024;
  margin-bottom: 16px;
  font-family: 'SF Pro Display';

  @media (max-width: 768px) {
    font-size: 14px;
  }
`

const Btns = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;

  @media (max-width: 768px) {
    flex-direction: column-reverse;
    width: 100%;
  }
`

const CancelButton = styled(Button)`
  height: 32px;
  padding: 6px 14px;
  color: #60646c;
  border: none;
  background-color: rgba(0, 0, 51, 0.06);

  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
  }
`

const DangerBtn = styled.button`
  height: 32px;
  padding: 0px 14px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-weight: 500;
  font-size: 14px;
  line-height: 143%;
  background: #e5484d;
  color: #fff;

  @media (max-width: 768px) {
    width: 100%;
  }

  &:hover {
    filter: brightness(0.98);
  }
`

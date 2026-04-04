import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { Drawer } from 'vaul'

import { Button } from '@/features/shared'

type CreateProjectPayload = {
  name: string
  rate: string
  description: string
}

type CreateProjectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (payload: CreateProjectPayload) => void
}

export const CreateProjectModal = ({
  open,
  onOpenChange,
  onCreate,
}: CreateProjectModalProps) => {
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [description, setDescription] = useState('')
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
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
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      return
    }
    setName('')
    setRate('')
    setDescription('')
  }, [open])

  const canSubmit = useMemo(() => name.trim().length > 0, [name])

  const submit = () => {
    if (!canSubmit) {
      return
    }
    onCreate?.({
      name: name.trim(),
      rate: rate.trim(),
      description: description.trim(),
    })
    onOpenChange(false)
  }

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <MobileOverlay />
          <MobileContent>
            <MobileSheet>
              <MobileHandle />
              <MobileBody>
                <Head>
                  <ModalTitle>Start a New Project</ModalTitle>
                  <ModalDesc>
                    You&apos;re creating a personal project to track your time
                    and progress. This project is private, meaning freelancers
                    won&apos;t see it, and you won&apos;t be able to assign it
                    to anyone.
                  </ModalDesc>
                </Head>

                <Form>
                  <Field>
                    <Label>Project name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder='E.g., "Website Redesign" or "Marketing Strategy"'
                    />
                  </Field>

                  <Field>
                    <Label>Rate</Label>
                    <RateRow>
                      <Input
                        value={rate}
                        inputMode="decimal"
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="Enter your hourly rate"
                      />
                      <RateSuffix>$</RateSuffix>
                    </RateRow>
                  </Field>

                  <Field>
                    <Label>Description</Label>
                    <TextArea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Briefly describe your project goals and tasks"
                    />
                  </Field>
                </Form>
              </MobileBody>

              <MobileFooter>
                <FooterBtn
                  type="button"
                  themeVariant="secondary"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </FooterBtn>
                <PrimaryFooterBtn
                  type="button"
                  disabled={!canSubmit}
                  onClick={submit}
                >
                  Create project
                </PrimaryFooterBtn>
              </MobileFooter>
            </MobileSheet>
          </MobileContent>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

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
            <Head>
              <ModalTitle>Start a New Project</ModalTitle>
              <ModalDesc>
                You&apos;re creating a personal project to track your time and
                progress. This project is private, meaning freelancers
                won&apos;t see it, and you won&apos;t be able to assign it to
                anyone.
              </ModalDesc>
            </Head>

            <Form>
              <Field>
                <Label>Project name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='E.g., "Website Redesign" or "Marketing Strategy"'
                />
              </Field>

              <Field>
                <Label>Rate</Label>
                <RateRow>
                  <Input
                    value={rate}
                    inputMode="decimal"
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="Enter your hourly rate"
                  />
                  <RateSuffix>$</RateSuffix>
                </RateRow>
              </Field>

              <Field>
                <Label>Description</Label>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe your project goals and tasks"
                />
              </Field>
            </Form>

            <Footer>
              <FooterBtn
                type="button"
                themeVariant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </FooterBtn>
              <PrimaryFooterBtn
                type="button"
                disabled={!canSubmit}
                onClick={submit}
              >
                Create project
              </PrimaryFooterBtn>
            </Footer>
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
  padding: 16px;
`

const Box = styled(motion.div)`
  width: min(450px, 100%);
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid rgba(0, 0, 51, 0.06);
  box-shadow:
    0 12px 60px 0 rgba(0, 0, 0, 0.15),
    0 12px 32px -16px rgba(0, 9, 50, 0.12);
`

const Head = styled.div`
  margin-bottom: 16px;
`

const ModalTitle = styled.div`
  font-weight: 500;
  font-size: 20px;
  line-height: 140%;
  letter-spacing: 0em;
  color: #1c2024;
  margin-bottom: 6px;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`

const ModalDesc = styled.div`
  font-weight: 400;
  font-size: 14px;
  line-height: 143%;
  color: #60646c;

  @media (max-width: 768px) {
    font-size: 12px;
  }
`

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const Label = styled.label`
  font-weight: 500;
  font-size: 14px;
  line-height: 143%;
  color: #1c2024;
`

const Input = styled.input`
  height: 32px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 47, 0.15);
  background: #fff;
  outline: none;
  font-weight: 400;
  font-size: 14px;
  line-height: 150%;
  color: #1c2024;

  &::placeholder {
    font-weight: 400;
    font-size: 14px;
    line-height: 150%;
    color: rgba(0, 5, 29, 0.45);
  }
`

const TextArea = styled.textarea`
  min-height: 120px;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 47, 0.15);
  background: #fff;
  font-size: 14px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.72);
  outline: none;
  resize: vertical;
  font-family: 'Inter', sans-serif;

  &::placeholder {
    font-weight: 400;
    font-size: 14px;
    line-height: 150%;
    color: rgba(0, 5, 29, 0.45);
  }
`

const RateRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0;

  input {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: 0;
  }
`

const RateSuffix = styled.div`
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(0, 0, 47, 0.15);
  border-left: none;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #80838d;
  background: #fff;
`

const Footer = styled.div`
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`

const FooterBtn = styled(Button)`
  height: 32px;
  padding: 6px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #60646c;
  border: none;
  background-color: rgba(0, 0, 51, 0.06);
`

const PrimaryFooterBtn = styled.button`
  height: 32px;
  padding: 0px 14px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-weight: 500;
  font-size: 14px;
  line-height: 143%;
  background: #3f67a4;
  color: #fff;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:hover {
    filter: brightness(0.98);
  }
`

const MobileOverlay = styled(Drawer.Overlay)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 250;
`

const MobileContent = styled(Drawer.Content)`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 251;
  outline: none;
`

const MobileSheet = styled.div`
  background: #fff;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -10px 35px rgba(0, 0, 0, 0.12);
  max-height: 92vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

const MobileHandle = styled.div`
  width: 52px;
  height: 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  margin: 10px auto 0;
`

const MobileBody = styled.div`
  padding: 16px;
  overflow: auto;
  min-height: 0;
`

const MobileFooter = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  border-top: 1px solid rgba(0, 0, 47, 0.15);
  padding: 8px 16px 25px;
  background: #fff;
`

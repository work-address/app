import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

export type PaymentStatus = 'Paid' | 'Unpaid'

export type WorklogRow = {
  key: string
  dateRange: string
  date: string
  projectName: string
  note: string
  timeActive: string
  paymentStatus: PaymentStatus
  keyboard: string
  mouse: string
  mouseDistance: string
  screenshot?: string
}

type WorklogsTableProps = {
  rows: WorklogRow[]
}

function ImagePlaceholder() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: 'rgba(0, 7, 20, 0.4)' }}
    >
      <path
        d="M4 5.5C4 4.67157 4.67157 4 5.5 4H18.5C19.3284 4 20 4.67157 20 5.5V18.5C20 19.3284 19.3284 20 18.5 20H5.5C4.67157 20 4 19.3284 4 18.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 14L10.5 11.5L14.5 15.5L16.5 13.5L20 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9.25C9 9.94036 8.44036 10.5 7.75 10.5C7.05964 10.5 6.5 9.94036 6.5 9.25C6.5 8.55964 7.05964 8 7.75 8C8.44036 8 9 8.55964 9 9.25Z"
        fill="currentColor"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export const WorklogsTable = ({ rows }: WorklogsTableProps) => {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [openShot, setOpenShot] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)

  const allSelected = rows.length > 0 && rows.every((r) => selected[r.key])

  const visibleRows = useMemo(() => rows, [rows])

  const setAll = (checked: boolean) => {
    const next: Record<string, boolean> = {}
    for (const r of rows) {
      next[r.key] = checked
    }
    setSelected(next)
  }

  const setOne = (key: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [key]: checked }))
  }

  useEffect(() => {
    if (!openShot) {
      return
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenShot(null)
      }
    }

    const onDown = (e: MouseEvent) => {
      const el = modalRef.current
      if (!el) {
        return
      }
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpenShot(null)
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [openShot])

  return (
    <Wrap>
      <Scroll>
        <TableEl>
          <Thead>
            <tr>
              <CheckCell>
                <Checkbox
                  checked={allSelected}
                  onChange={(e) => setAll(e.target.checked)}
                />
              </CheckCell>
              <Th>Date</Th>
              <Th>Project name</Th>
              <Th>Note</Th>
              <Th>Time active</Th>
              <Th>Payment status</Th>
              <ThRight>Keyboard</ThRight>
              <ThRight>Mouse</ThRight>
              <ThRight>Mouse distance</ThRight>
              <Th>Screenshot</Th>
              <ThRight />
            </tr>
          </Thead>
          <tbody>
            {visibleRows.map((r) => (
              <Tr key={r.key}>
                <CheckTd>
                  <Checkbox
                    checked={!!selected[r.key]}
                    onChange={(e) => setOne(r.key, e.target.checked)}
                  />
                </CheckTd>
                <Td>
                  <DateCell>
                    <DateRange>{r.dateRange}</DateRange>
                    <DateMuted>{r.date}</DateMuted>
                  </DateCell>
                </Td>
                <Td style={{ color: 'rgba(0, 7, 20, 0.88)' }}>
                  {r.projectName}
                </Td>
                <Td>{r.note}</Td>
                <Td>
                  <TimePill>{r.timeActive}</TimePill>
                </Td>
                <Td>
                  <PaymentPill $status={r.paymentStatus}>
                    {r.paymentStatus}
                  </PaymentPill>
                </Td>
                <TdRight>{r.keyboard}</TdRight>
                <TdRight>{r.mouse}</TdRight>
                <TdRight>{r.mouseDistance}</TdRight>
                <Td>
                  {r.screenshot ? (
                    <ShotBtn
                      type="button"
                      aria-label="Open screenshot"
                      onClick={() => setOpenShot(r.screenshot ?? null)}
                    >
                      <Shot>
                        <img src={r.screenshot} alt="Screenshot" />
                      </Shot>
                    </ShotBtn>
                  ) : (
                    <Shot>
                      <ImagePlaceholder />
                    </Shot>
                  )}
                </Td>
                <TdRight>
                  <Actions>
                    <ActionBtn aria-label="Edit">
                      <ActionIcon src="/img/icons/edit.svg" alt="Edit" />
                    </ActionBtn>
                  </Actions>
                </TdRight>
              </Tr>
            ))}
          </tbody>
        </TableEl>
      </Scroll>

      <AnimatePresence>
        {openShot ? (
          <ModalStage
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            <Modal
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.16 }}
            >
              <CloseBtn
                type="button"
                aria-label="Close"
                onClick={() => setOpenShot(null)}
              >
                <CloseIcon />
              </CloseBtn>
              <ModalImg src={openShot} alt="Screenshot" />
            </Modal>
          </ModalStage>
        ) : null}
      </AnimatePresence>
    </Wrap>
  )
}

const Wrap = styled.div`
  border: 1px solid rgba(0, 0, 45, 0.09);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 1px 4px 0 rgba(0, 0, 45, 0.09),
    0 2px 1px -1px rgba(0, 0, 0, 0.05),
    0 1px 3px 0 rgba(0, 0, 0, 0.05);
`

const Scroll = styled.div`
  width: 100%;
  overflow: auto;
`

const TableEl = styled.table`
  width: 100%;
  min-width: 1200px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  color: var(--primary);
`

const Thead = styled.thead`
  background: #f9f9fb;
`

const Th = styled.th`
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: rgba(28, 32, 36, 0.75);
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 47, 0.15);
  white-space: nowrap;
`

const ThRight = styled(Th)`
  text-align: left;
`

const Td = styled.td`
  padding: 14px;
  border-bottom: 1px solid rgba(0, 0, 47, 0.15);
  white-space: nowrap;
  color: #60646c;
  font-weight: 400;
  font-size: 14px;
  line-height: 143%;
  vertical-align: middle;
`

const TdRight = styled(Td)`
  text-align: left;
`

const Tr = styled.tr`
  &:hover ${Td} {
    background: rgba(0, 52, 130, 0.04);
  }
`

const CheckCell = styled(Th)`
  width: 44px;
  padding-left: 16px;
  padding-right: 8px;
  vertical-align: middle;
`

const CheckTd = styled(Td)`
  width: 44px;
  padding-left: 16px;
  padding-right: 8px;
  vertical-align: middle;
`

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 16px;
  height: 16px;
  border: 1px solid rgba(0, 6, 46, 0.2);
  border-radius: 3px;
  background: #fff;
  appearance: none;
  -webkit-appearance: none;
  display: block;
  box-sizing: border-box;
  position: relative;

  &:checked {
    background: #3f67a4;
    border-color: #3f67a4;
  }

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    width: 9px;
    height: 5px;
    border: 2px solid #fff;
    border-top: 0;
    border-right: 0;
    margin-top: -1px;
    opacity: 0;
  }

  &:checked::after {
    opacity: 1;
  }
`

const DateCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const DateRange = styled.div`
  color: rgba(0, 7, 20, 0.88);
`

const DateMuted = styled.div`
  font-size: 12px;
  color: rgba(0, 7, 20, 0.55);
`

const TimePill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  background: rgba(0, 164, 51, 0.1);
  color: rgba(0, 113, 63, 0.87);
`

const PaymentPill = styled.span<{ $status: PaymentStatus }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  background: ${(p) =>
    p.$status === 'Paid' ? 'rgba(0, 164, 51, 0.1)' : 'rgba(255, 193, 7, 0.18)'};
  color: ${(p) =>
    p.$status === 'Paid' ? 'rgba(0, 113, 63, 0.87)' : 'rgba(140, 93, 0, 0.9)'};
`

const ShotBtn = styled.button`
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: inline-flex;

  &:focus {
    outline: none;
  }
`

const Shot = styled.div`
  width: 64px;
  height: 48px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  border-radius: 2px;
  background: rgba(0, 0, 51, 0.03);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  & > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

const ModalStage = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 8, 48, 0.27);
  pointer-events: none;
`

const Modal = styled(motion.div)`
  pointer-events: auto;
  position: relative;
  max-width: min(980px, calc(100vw - 48px));
  max-height: min(720px, calc(100vh - 48px));
  /* overflow: hidden; */
  border: 1px solid rgba(0, 0, 51, 0.12);
  background: #fff;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
`

const ModalImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  max-height: min(720px, calc(100vh - 48px));
  object-fit: contain;
  background: #fff;
`

const CloseBtn = styled.button`
  position: absolute;
  top: -3px;
  right: -35px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fcfcfd;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &:focus {
    outline: none;
  }
`

const Actions = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
`

const ActionBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  width: 32px;
  height: 32px;

  &:hover {
    background: rgba(0, 0, 51, 0.06);
  }
`

const ActionIcon = styled.img`
  display: block;
`

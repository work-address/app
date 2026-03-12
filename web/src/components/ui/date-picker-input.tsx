import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
} from 'react-aria-components'
import { CalendarDate } from '@internationalized/date'
import styled from 'styled-components'

type DatePickerInputProps = {
  value?: Date
  onChange: (value?: Date) => void
  placeholder?: string
}

function toCalendarDate(value?: Date) {
  if (!value) return undefined
  return new CalendarDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
}

function toJsDate(value?: CalendarDate) {
  if (!value) return undefined
  return new Date(value.year, value.month - 1, value.day)
}

function formatDate(value?: Date) {
  if (!value) return ''
  const dd = String(value.getDate()).padStart(2, '0')
  const mm = String(value.getMonth() + 1).padStart(2, '0')
  const yyyy = value.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 3v3M17 3v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 9h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DatePickerInput({ value, onChange, placeholder }: DatePickerInputProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CalendarDate | undefined>(toCalendarDate(value))
  const [side, setSide] = useState<'left' | 'right'>('left')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) setDraft(toCalendarDate(value))
  }, [open, value])

  useEffect(() => {
    if (!open) return

    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const popoverW = 340
    const padding = 16
    const overflowRight = r.left + popoverW > window.innerWidth - padding
    setSide(overflowRight ? 'right' : 'left')
  }, [open, draft, value])

  useEffect(() => {
    if (!open) return

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }

    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selected = useMemo(() => draft ?? toCalendarDate(value), [draft, value])

  return (
    <Root ref={rootRef}>
      <InputButton type="button" onClick={() => setOpen((v) => !v)}>
        <Icon>
          <CalendarIcon />
        </Icon>
        <InputText $hasValue={!!value}>{value ? formatDate(value) : placeholder}</InputText>
      </InputButton>

      {open ? (
        <Popover $side={side}>
          <CalendarWrap>
            <Calendar aria-label="Calendar" value={selected} onChange={(d) => setDraft(d as CalendarDate)}>
              <CalHeader>
                <NavBtn slot="previous" aria-label="Previous month">
                  <ChevronLeft />
                </NavBtn>
                <CalHeading />
                <NavBtn slot="next" aria-label="Next month">
                  <ChevronRight />
                </NavBtn>
              </CalHeader>
              <CalendarGrid>
                <CalGridHeader>
                  {(day) => <CalHeaderCell>{day}</CalHeaderCell>}
                </CalGridHeader>
                <CalendarGridBody>
                  {(date) => <CalCell date={date}>{date.day}</CalCell>}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>
          </CalendarWrap>

          <Actions>
            <ActionBtn
              type="button"
              onClick={() => {
                setDraft(toCalendarDate(value))
                setOpen(false)
              }}
            >
              Cancel
            </ActionBtn>
            <ConfirmBtn
              type="button"
              onClick={() => {
                onChange(toJsDate(draft))
                setOpen(false)
              }}
            >
              Confirm
            </ConfirmBtn>
          </Actions>
        </Popover>
      ) : null}
    </Root>
  )
}

const Root = styled.div`
  position: relative;
  width: 100%;
`

const InputButton = styled.button`
  width: 100%;
  height: 34px;
  border-radius: 4px;
  border: 1px solid rgba(0, 8, 48, 0.12);
  padding: 0 10px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 8px;

  &:focus {
    outline: none;
    border-color: rgba(0, 52, 130, 0.55);
  }
`

const Icon = styled.span`
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(28, 32, 36, 0.55);
`

const InputText = styled.span<{ $hasValue?: boolean }>`
  font-size: 13px;
  color: ${(p) => (p.$hasValue ? 'var(--primary)' : 'rgba(28, 32, 36, 0.45)')};
`

const Popover = styled.div<{ $side: 'left' | 'right' }>`
  position: absolute;
  left: ${(p) => (p.$side === 'left' ? '0' : 'auto')};
  right: ${(p) => (p.$side === 'right' ? '0' : 'auto')};
  top: calc(100% + 8px);
  z-index: 50;
  width: 340px;
  max-width: calc(100vw - 40px);
  background: #fff;
  border: 1px solid rgba(0, 0, 51, 0.12);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
`

const CalendarWrap = styled.div`
  padding: 14px 16px 10px;

  [data-react-aria-calendar] {
    width: 100%;
  }

  [data-react-aria-calendar-grid] {
    width: 100%;
    border-collapse: collapse;
  }

  [data-react-aria-calendar-grid] td {
    padding: 0;
  }
`

const CalHeader = styled.header`
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  align-items: center;
  margin-bottom: 12px;
`

const CalHeading = styled(Heading)`
  justify-self: center;
  font-weight: 600;
  font-size: 16px;
  color: rgba(0, 7, 20, 0.88);
`

const NavBtn = styled(Button)`
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 7, 20, 0.6);

  background: transparent;
  border: 0;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 51, 0.06);
  }
`

const CalGridHeader = styled(CalendarGridHeader)`
  font-size: 12px;
  font-weight: 500;
  color: rgba(0, 7, 20, 0.55);
`

const CalHeaderCell = styled(CalendarHeaderCell)`
  padding: 10px 0 8px;
  text-align: center;
`

const CalCell = styled(CalendarCell)`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 7, 20, 0.88);
  margin: 3px 0;

  &[data-outside-month] {
    color: rgba(0, 7, 20, 0.22);
  }

  &[data-selected] {
    background: #3f67a4;
    color: #fff;
  }

  &[data-today] {
    box-shadow: inset 0 0 0 2px rgba(0, 52, 130, 0.22);
  }

  &[data-hovered] {
    background: rgba(0, 52, 130, 0.08);
  }

  &[data-disabled] {
    color: rgba(0, 7, 20, 0.22);
  }
`

const Actions = styled.div`
  padding: 12px 16px;
  border-top: 1px solid rgba(0, 0, 51, 0.12);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`

const ActionBtn = styled.button`
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 51, 0.14);
  background: #fff;
  color: rgba(0, 7, 20, 0.88);
  font-size: 13px;

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }
`

const ConfirmBtn = styled(ActionBtn)`
  background: #3f67a4;
  border-color: #3f67a4;
  color: #fff;

  &:hover {
    background: rgba(0, 52, 130, 0.92);
  }
`

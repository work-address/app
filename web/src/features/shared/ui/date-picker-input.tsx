import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons'
import { Popover, Text } from '@radix-ui/themes'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { useState } from 'react'
import styled from 'styled-components'

import { Button } from './button'
import { Input } from './input'

type DatePickerProps = {
  value?: Date | null
  onChange?: (date: Date | null) => void
  label?: string
  placeholder?: string
  id?: string
  labelWidth?: string
}

const formatter = new Intl.DateTimeFormat()

export const DatePickerInput = ({
  value,
  onChange,
  label,
  placeholder = 'Pick a date',
  id,
  labelWidth,
}: DatePickerProps) => {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(value ?? new Date())
  const [pendingDate, setPendingDate] = useState<Date | null>(value ?? null)

  const handleConfirm = () => {
    onChange?.(pendingDate)
    setOpen(false)
  }

  const handleCancel = () => {
    setPendingDate(value ?? null)
    setOpen(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPendingDate(value ?? null)
    }
    setOpen(next)
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate)),
    end: endOfWeek(endOfMonth(viewDate)),
  })

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <Popover.Trigger>
        <span>
          <Input
            id={id}
            label={label}
            labelWidth={labelWidth}
            value={value ? formatter.format(value).toString() : ''}
            placeholder={placeholder}
            addonLeft={<CalendarIcon />}
            style={{ cursor: 'pointer' }}
          />
        </span>
      </Popover.Trigger>

      <Popover.Content
        style={{ padding: 0, width: 340, zIndex: 100 }}
        align="start"
        sideOffset={4}
        container={document.body}
      >
        <CalendarWrapper>
          <CalendarHeader>
            <NavButton onClick={() => setViewDate(subMonths(viewDate, 1))}>
              <ChevronLeftIcon width={18} height={18} />
            </NavButton>

            <MonthLabel>
              <Text size="4" weight="bold">
                {format(viewDate, 'MMMM yyyy')}
              </Text>
            </MonthLabel>

            <NavButton onClick={() => setViewDate(addMonths(viewDate, 1))}>
              <ChevronRightIcon width={18} height={18} />
            </NavButton>
          </CalendarHeader>

          <CalendarGrid>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <WeekDay key={d}>
                <Text size="1" color="gray" weight="medium">
                  {d}
                </Text>
              </WeekDay>
            ))}

            {days.map((day) => {
              const isSelected = pendingDate
                ? isSameDay(day, pendingDate)
                : false
              const isCurrentMonth = isSameMonth(day, viewDate)
              const isTodayDate = isToday(day)

              return (
                <DayCell
                  key={day.toISOString()}
                  $selected={isSelected}
                  $otherMonth={!isCurrentMonth}
                  $today={isTodayDate && !isSelected}
                  onClick={() => setPendingDate(day)}
                >
                  <Text size="2" weight={isSelected ? 'bold' : 'regular'}>
                    {format(day, 'd')}
                  </Text>
                </DayCell>
              )
            })}
          </CalendarGrid>

          <CalendarFooter>
            <Button themeVariant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button themeVariant="primary" onClick={handleConfirm}>
              Confirm
            </Button>
          </CalendarFooter>
        </CalendarWrapper>
      </Popover.Content>
    </Popover.Root>
  )
}

const CalendarWrapper = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const CalendarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const MonthLabel = styled.div`
  flex: 1;
  text-align: center;
`

const NavButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-2);
  color: var(--ds-neutral-11);
  transition: background 0.15s;

  &:hover {
    background: var(--ds-neutral-alpha-3);
  }
`

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px 0;
`

const WeekDay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
`

const DayCell = styled.div<{
  $selected?: boolean
  $otherMonth?: boolean
  $today?: boolean
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s;
  opacity: ${({ $otherMonth }) => ($otherMonth ? 0.3 : 1)};

  background: ${({ $selected }) =>
    $selected ? 'var(--ds-accent-11)' : 'transparent'};

  color: ${({ $selected }) =>
    $selected ? 'var(--white)' : 'var(--ds-neutral-12)'};

  outline: ${({ $today }) =>
    $today ? '1.5px solid var(--ds-accent-11)' : 'none'};

  &:hover {
    background: ${({ $selected }) =>
      $selected ? 'var(--ds-accent-11)' : 'var(--ds-neutral-alpha-3)'};
  }
`

const CalendarFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--ds-neutral-alpha-6);
`

import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons'
import { Popover, Text } from '@radix-ui/themes'
import {
  addDays,
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
import { enUS, ru } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Button } from './button'
import { Input, type InputProps } from './input'

type DatePickerProps = {
  value?: Date | null
  onChange?: (date: Date | null) => void
  label?: string
  placeholder?: string
  id?: string
  labelWidth?: string
  inputProps?: InputProps
}

function dateFnsLocaleFor(lng: string | undefined) {
  return lng?.toLowerCase().startsWith('ru') ? ru : enUS
}

function intlLocaleFor(lng: string | undefined) {
  return lng?.toLowerCase().startsWith('ru') ? 'ru-RU' : 'en-US'
}

export const DatePickerInput = ({
  value,
  onChange,
  label,
  placeholder,
  id,
  labelWidth,
  inputProps,
}: DatePickerProps) => {
  const { t, i18n } = useTranslation()
  const dateFnsLocale = dateFnsLocaleFor(i18n.resolvedLanguage)
  const resolvedPlaceholder = placeholder ?? t('ui.datePicker.pickDate')
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(value ?? new Date())
  const [pendingDate, setPendingDate] = useState<Date | null>(value ?? null)

  const inputDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocaleFor(i18n.resolvedLanguage)),
    [i18n.resolvedLanguage],
  )

  const weekDayLabels = useMemo(() => {
    const ref = startOfWeek(new Date(2025, 0, 15), { locale: dateFnsLocale })
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(ref, i), 'EEE', { locale: dateFnsLocale }),
    )
  }, [dateFnsLocale])

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), { locale: dateFnsLocale }),
    end: endOfWeek(endOfMonth(viewDate), { locale: dateFnsLocale }),
  })

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

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <Popover.Trigger>
        <span style={{ width: '100%' }}>
          <Input
            id={id}
            label={label}
            labelWidth={labelWidth}
            value={value ? inputDateFormatter.format(value) : ''}
            placeholder={resolvedPlaceholder}
            addonLeft={<CalendarIcon />}
            style={{ cursor: 'pointer', pointerEvents: 'none' }}
            {...inputProps}
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
            <NavButton
              type="button"
              aria-label={t('ui.datePicker.previousMonth')}
              onClick={() => setViewDate(subMonths(viewDate, 1))}
            >
              <ChevronLeftIcon width={18} height={18} />
            </NavButton>

            <MonthLabel>
              <Text size="4" weight="bold">
                {format(viewDate, 'LLLL yyyy', { locale: dateFnsLocale })}
              </Text>
            </MonthLabel>

            <NavButton
              type="button"
              aria-label={t('ui.datePicker.nextMonth')}
              onClick={() => setViewDate(addMonths(viewDate, 1))}
            >
              <ChevronRightIcon width={18} height={18} />
            </NavButton>
          </CalendarHeader>

          <CalendarGrid>
            {weekDayLabels.map((d, i) => (
              <WeekDay key={`${d}-${i}`}>
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
              {t('ui.datePicker.cancel')}
            </Button>
            <Button themeVariant="primary" onClick={handleConfirm}>
              {t('ui.datePicker.confirm')}
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

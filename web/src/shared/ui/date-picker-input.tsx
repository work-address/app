import { CalendarIcon, Cross2Icon } from '@radix-ui/react-icons'
import { Popover } from '@radix-ui/themes'
import { useId, useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { enUS, es, ja, ru, zhCN } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Button } from './button/ui/button'
import { IconButton } from './button/ui/icon-button'

import type { InputProps } from './input'

type DatePickerProps = {
  value?: Date | null
  onChange?: (date: Date | null) => void
  label?: string
  placeholder?: string
  id?: string
  labelWidth?: string
  inputProps?: InputProps
  allowClear?: boolean
}

const locales = { en: enUS, es, ja, ru, zh: zhCN }

export const DatePickerInput = ({
  value,
  onChange,
  label,
  placeholder,
  id,
  inputProps,
  allowClear = true,
}: DatePickerProps) => {
  const { t, i18n } = useTranslation()
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(value ?? new Date())
  const [pendingDate, setPendingDate] = useState<Date | null>(value ?? null)
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const locale = locales[language.split('-')[0] as keyof typeof locales] ?? enUS
  const formatter = useMemo(() => new Intl.DateTimeFormat(language), [language])
  const disabled = Boolean(inputProps?.disabled || inputProps?.readOnly)
  const ph = placeholder ?? t('ui.datePicker.pickDate')

  const changeOpen = (next: boolean) => {
    if (next && disabled) {
      return
    }
    setPendingDate(value ?? null)
    if (next) {
      setMonth(value ?? new Date())
    }
    setOpen(next)
  }

  return (
    <Root>
      {label ? <Label htmlFor={fieldId}>{label}</Label> : null}
      <Popover.Root open={open} onOpenChange={changeOpen} modal={false}>
        <Field>
          <Popover.Trigger>
            <Trigger
              id={fieldId}
              type="button"
              disabled={disabled}
              aria-label={label ? undefined : ph}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? `${fieldId}-calendar` : undefined}
              data-placeholder={!value || undefined}
              style={inputProps?.style}
            >
              <CalendarIcon aria-hidden />
              <Value>{value ? formatter.format(value) : ph}</Value>
            </Trigger>
          </Popover.Trigger>
          {value && allowClear ? (
            <Clear
              type="button"
              variant="ghost"
              color="gray"
              size="1"
              disabled={disabled}
              aria-label={t('ui.datePicker.clear')}
              onClick={() => {
                setPendingDate(null)
                onChange?.(null)
                setOpen(false)
              }}
            >
              <Cross2Icon aria-hidden />
            </Clear>
          ) : null}
        </Field>
        <Content
          id={`${fieldId}-calendar`}
          aria-label={label ?? ph}
          align="start"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={pendingDate ?? undefined}
            onSelect={(date) => setPendingDate(date ?? null)}
            month={month}
            onMonthChange={setMonth}
            locale={locale}
            autoFocus
          />
          <Footer>
            <Button
              type="button"
              color="neutral"
              variant="soft"
              onClick={() => changeOpen(false)}
            >
              {t('ui.datePicker.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onChange?.(pendingDate)
                setOpen(false)
              }}
            >
              {t('ui.datePicker.confirm')}
            </Button>
          </Footer>
        </Content>
      </Popover.Root>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--ui-space-2);
  width: 100%;
  min-width: 0;
`
const Label = styled.label`
  font-size: var(--ui-meta-size);
  font-weight: 500;
`
const Field = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  /* Include the border in the same outside height as Input. */
  height: var(--date-field-height, var(--ui-space-6));
  border: 1px solid var(--ui-field-border, var(--ui-line));
  border-radius: var(--date-field-radius, var(--ui-row-radius));
  background: var(--ui-field-background, var(--ui-surface));
  &:hover:not(:has(button:disabled)) {
    border-color: var(--ui-field-border-hover, var(--ui-muted));
  }
  &:focus-within {
    outline: var(--ui-focus-width, 2px) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset, 2px);
  }
  &:has(button:disabled) {
    background: var(--ui-field-background-locked, var(--ui-inset));
  }
  ${(p) => p.theme.breakpoints.down('md')} {
    height: var(--date-field-height, var(--ui-space-7));
  }
`
const Trigger = styled.button`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--ui-space-2);
  align-items: center;
  padding: 0 var(--date-field-padding, var(--ui-space-2));
  height: 100%;
  min-height: 0;
  min-width: 0;
  color: var(--ui-text);
  text-align: left;
  font: inherit;
  font-size: var(--date-field-font-size, var(--ui-meta-size));
  line-height: var(--ui-meta-line-height);
  outline: none;
  &[data-placeholder] {
    color: var(--ui-muted);
  }
  &:disabled {
    color: var(--ui-muted);
    cursor: not-allowed;
  }
  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--date-field-font-size, var(--ui-body-size));
    line-height: var(--ui-body-line-height);
  }
`
const Value = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const Clear = styled(IconButton)`
  margin-inline-end: var(--ui-space-2);
`
const Content = styled(Popover.Content)`
  width: max-content;
  max-width: calc(100vw - var(--ui-space-7));
  padding: var(--ui-space-3);
  z-index: 100;
`
const Calendar = styled(DayPicker)`
  --rdp-accent-color: var(--ui-blue);
  --rdp-accent-background-color: var(--ui-glow);
  --rdp-day-width: 40px;
  --rdp-day-height: 40px;
  --rdp-day_button-width: 40px;
  --rdp-day_button-height: 40px;
  --rdp-selected-border: 2px solid var(--ui-blue);
  font-family: inherit;
  font-size: var(--ui-meta-size);
  color: var(--ui-text);
`
const Footer = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: end;
  gap: var(--ui-space-2);
  padding-block-start: var(--ui-space-3);
  margin-block-start: var(--ui-space-3);
  border-top: 1px solid var(--ui-line);
`

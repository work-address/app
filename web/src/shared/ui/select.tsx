import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
} from '@radix-ui/react-icons'
import { Popover } from '@radix-ui/themes'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useBreakpoint } from '../hooks'

import { Button } from './button/ui/button'
import { Checkbox } from './checkbox'
import { Drawer } from './dialogs/ui/drawer'
import { Input } from './input'
import { Text } from './text'

import type { InputProps } from './input'

export type SelectOption = {
  value: string
  label: string
  /** Listed but not choosable: the reason belongs beside the field. */
  disabled?: boolean
}

type SelectProps = {
  className?: string
  options: SelectOption[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  placeholder?: string
  multi?: boolean
  title?: string
  label?: string
  allSelectedText?: string
  inputProps?: InputProps
  menuMaxHeight?: string | number
  /** Shows the current value but never opens; the field reads as disabled. */
  disabled?: boolean
}

export const Select = ({
  className,
  options,
  value,
  onChange,
  placeholder,
  multi,
  title,
  label,
  allSelectedText,
  inputProps,
  menuMaxHeight,
  disabled = false,
}: SelectProps) => {
  const { t } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')
  const [openState, setOpenState] = useState(false)
  // A disabled field never opens, whatever the trigger reports - the
  // wrapper, not the input, receives the click.
  const open = openState && !disabled
  const setOpen = (next: boolean) => setOpenState(next && !disabled)

  const ph = placeholder ?? t('ui.motionSelect.placeholder')

  // An empty string is a real choice when the options offer one - "All
  // projects", say - and only means "nothing chosen" when they do not.
  const hasEmptyOption = useMemo(
    () => !multi && options.some((o) => o.value === ''),
    [multi, options],
  )

  const selectedSet = useMemo(() => {
    const arr = Array.isArray(value)
      ? value
      : value || hasEmptyOption
        ? [value]
        : []
    return new Set(arr)
  }, [value, hasEmptyOption])

  const buttonText = useMemo(() => {
    if (selectedSet.size === 0) {
      return null
    }

    if (multi && selectedSet.size === options.length) {
      return allSelectedText ?? 'All selected'
    }

    const labels = options
      .filter((o) => selectedSet.has(o.value))
      .map((o) => o.label)

    return labels.length > 0 ? labels.join(', ') : null
  }, [multi, options, selectedSet, allSelectedText])

  const toggle = (v: string) => {
    if (!multi) {
      onChange(v)
      setOpen(false)
      return
    }

    const next = new Set(selectedSet)
    next.has(v) ? next.delete(v) : next.add(v)
    onChange([...next])
  }

  const Content = (
    <>
      {title && <MenuTitle>{title}</MenuTitle>}
      <MenuList $maxHeight={menuMaxHeight} role="listbox">
        {options.map((o) => {
          const checked = selectedSet.has(o.value)

          return (
            <MenuItem
              key={o.value}
              type="button"
              role="option"
              aria-selected={checked}
              aria-disabled={o.disabled || undefined}
              data-selected={checked || undefined}
              disabled={o.disabled}
              onClick={() => toggle(o.value)}
            >
              {isDesktop && multi && <Checkbox checked={checked} />}
              <ItemLabel size={'3'}>{o.label}</ItemLabel>
              {/* The current choice is marked in every list, not only the
                  multi one: a single-select reopened later should show what
                  it already holds. */}
              {(!multi || isMobile) && (
                <ItemCheck
                  aria-hidden="true"
                  data-visible={checked || undefined}
                />
              )}
            </MenuItem>
          )
        })}
      </MenuList>
    </>
  )

  const TriggerEl = (
    <InputWrapper data-open={open || undefined}>
      <Input
        className={className}
        label={label}
        addonRight={open ? <ChevronUpIcon /> : <ChevronDownIcon />}
        value={buttonText ? buttonText : ''}
        columns={'1fr'}
        onChange={() => {}}
        onKeyDown={(e) => e.preventDefault()}
        placeholder={ph}
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          caretColor: 'transparent',
        }}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        {...inputProps}
        disabled={disabled || inputProps?.disabled}
        readOnly
      />
    </InputWrapper>
  )

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={setOpen}
        // The sheet is titled by the field it opened from, so "Select" alone
        // never has to stand in for "Project status".
        title={title ?? label ?? ph}
        trigger={TriggerEl}
        footer={
          multi ? (
            <Button stretch onClick={() => setOpen(false)}>
              {t('common.apply')}
            </Button>
          ) : undefined
        }
      >
        {Content}
      </Drawer>
    )
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>{TriggerEl}</Popover.Trigger>
      <PopoverContent>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.14 }}
            >
              {Content}
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover.Root>
  )
}

const PopoverContent = styled(Popover.Content)`
  z-index: 60;
  /* At least as wide as the trigger, wider when an option needs it, so long
     labels stay on one line instead of folding under themselves. */
  min-width: var(--radix-popover-trigger-width);
  max-width: min(360px, calc(100vw - 32px));
  outline: none;
  padding: var(--space-1);
`

const MenuTitle = styled.div`
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-1);
  letter-spacing: 0.06em;
  color: var(--c-rgba-0-5-29-0_55);
`

const MenuList = styled.div<{ $maxHeight?: string | number }>`
  display: flex;
  flex-direction: column;
  gap: 1px;

  ${(p) =>
    p.$maxHeight != null &&
    `
    max-height: ${typeof p.$maxHeight === 'number' ? `${p.$maxHeight}px` : p.$maxHeight};
    overflow-y: auto;
  `}
`

const MenuItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-2);
  padding: 12px;
  color: var(--gray-12);
  transition: background 0.12s ease;

  &:hover,
  &:focus-visible {
    background: var(--ds-neutral-alpha-3);
    outline: none;
  }

  &[data-selected] {
    background: var(--ds-accent-3);
    color: var(--ds-accent-11);
  }

  &:disabled {
    background: transparent;
    color: var(--gray-a8);
    cursor: not-allowed;
  }

  ${(p) => p.theme.breakpoints.up('md')} {
    padding: 7px 10px;
  }
`

const ItemLabel = styled(Text)`
  flex: 1;
  min-width: 0;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  ${(p) => p.theme.breakpoints.up('md')} {
    font-size: var(--font-size-2);
    line-height: var(--line-height-2);
  }
`

/* Always in the layout so labels line up whether or not they are chosen. */
const ItemCheck = styled(CheckIcon)`
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  opacity: 0;

  &[data-visible] {
    opacity: 1;
  }
`

const InputWrapper = styled.span`
  width: 100%;

  /* The wrapped input has pointer-events disabled, so hover falls through
     to this element; && doubles our class so the pointer cursor wins over
     the Radix text field's own default cursor instead of reaching for !important. */
  && {
    cursor: pointer;
  }

  &&:has(.rt-TextFieldInput:disabled) {
    cursor: not-allowed;
  }

  /* Radix paints a read-only field with the disabled gray fill. The trigger
     is read-only only to keep a caret out of it, so it takes the surface a
     writable field has and darkens a step on hover like a button would. */
  && .rt-TextFieldRoot:has(.rt-TextFieldInput:read-only:not(:disabled)) {
    background-image: none;
    box-shadow: inset 0 0 0 1px var(--gray-a7);
    transition: box-shadow 0.12s ease;
  }

  &:hover .rt-TextFieldRoot:has(.rt-TextFieldInput:read-only:not(:disabled)) {
    box-shadow: inset 0 0 0 1px var(--gray-a9);
  }

  & .rt-TextFieldInput {
    pointer-events: none;
    caret-color: transparent;
    /* Radix dims read-only text to the disabled tone; the trigger is read-only
       only to keep the caret out, so a chosen value stays at full strength. */
    color: var(--gray-12);
  }

  & .rt-TextFieldInput:placeholder-shown {
    color: var(--gray-a10);
  }

  & .rt-TextFieldInput:disabled {
    color: var(--gray-a11);
  }

  .rt-TextFieldSlot {
    cursor: pointer;
    color: var(--gray-11);
  }
`

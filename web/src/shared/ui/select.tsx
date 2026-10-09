import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@radix-ui/react-icons'
import { Popover } from '@radix-ui/themes'
import { useId, useMemo, useState, type CSSProperties } from 'react'
import { ListBox, ListBoxItem } from 'react-aria-components'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useBreakpoint } from '../hooks'

import { Button } from './button/ui/button'
import { Drawer } from './dialogs/ui/drawer'

import type { InputProps } from './input'

export type SelectOption = { value: string; label: string }

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
}: SelectProps) => {
  const { t } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const generatedId = useId()
  const id = inputProps?.id ?? generatedId
  const listId = `${id}-options`
  const [open, setOpen] = useState(false)
  const disabled = Boolean(inputProps?.disabled || inputProps?.readOnly)
  const ph = placeholder ?? t('ui.motionSelect.placeholder')
  const selectedKeys = useMemo(
    () =>
      new Set(
        Array.isArray(value)
          ? value
          : value || options.some((o) => o.value === '')
            ? [value]
            : [],
      ),
    [value, options],
  )
  const selectedLabels = options
    .filter((o) => selectedKeys.has(o.value))
    .map((o) => o.label)
  const buttonText =
    multi && options.length > 0 && selectedKeys.size === options.length
      ? (allSelectedText ?? t('ui.motionSelect.allSelected'))
      : selectedLabels.join(', ')

  const changeOpen = (next: boolean) => {
    if (!next || !disabled) {
      setOpen(next)
    }
  }
  const content = (
    <>
      {title && !isMobile ? <MenuTitle>{title}</MenuTitle> : null}
      <MenuList
        id={listId}
        aria-label={title ?? label ?? ph}
        selectionMode={multi ? 'multiple' : 'single'}
        selectionBehavior="toggle"
        disallowEmptySelection={!multi}
        escapeKeyBehavior="none"
        selectedKeys={selectedKeys}
        autoFocus="first"
        style={
          {
            '--select-menu-height':
              typeof menuMaxHeight === 'number'
                ? `${menuMaxHeight}px`
                : (menuMaxHeight ?? 'min(50dvh, 360px)'),
          } as CSSProperties
        }
        onSelectionChange={(keys) => {
          if (disabled) {
            return
          }
          const next =
            keys === 'all'
              ? options.map((o) => o.value)
              : Array.from(keys, String)
          onChange(multi ? next : (next[0] ?? ''))
          if (!multi) {
            setOpen(false)
          }
        }}
      >
        {options.map((o) => (
          <MenuItem
            key={o.value}
            id={o.value}
            textValue={o.label}
            onPress={() => {
              if (!disabled && !multi) {
                setOpen(false)
              }
            }}
          >
            {({ isSelected }) => (
              <>
                <ItemLabel>{o.label}</ItemLabel>
                <ItemCheck aria-hidden data-visible={isSelected || undefined} />
              </>
            )}
          </MenuItem>
        ))}
      </MenuList>
    </>
  )
  const trigger = (
    <Trigger
      id={id}
      type="button"
      disabled={disabled}
      name={inputProps?.name}
      aria-label={
        inputProps?.['aria-label'] ?? (label ? undefined : (title ?? ph))
      }
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-invalid={
        inputProps?.state === 'error' ||
        inputProps?.['aria-invalid'] ||
        undefined
      }
      aria-describedby={inputProps?.['aria-describedby']}
      data-placeholder={!buttonText || undefined}
      style={inputProps?.style}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          changeOpen(true)
        }
      }}
    >
      <Value>{buttonText || ph}</Value>
      {open ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
    </Trigger>
  )

  return (
    <Root
      className={className}
      data-inline-label={
        Boolean(
          label &&
            inputProps?.labelWidth &&
            inputProps?.columns !== '1' &&
            inputProps?.columns !== '1fr',
        ) || undefined
      }
      style={
        {
          '--select-label-width': inputProps?.labelWidth ?? 'auto',
        } as CSSProperties
      }
    >
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {isMobile ? (
        <Drawer
          open={open}
          onOpenChange={changeOpen}
          title={title ?? label ?? ph}
          trigger={trigger}
          footer={
            multi ? (
              <Button stretch onClick={() => setOpen(false)}>
                {t('common.apply')}
              </Button>
            ) : undefined
          }
        >
          {content}
        </Drawer>
      ) : (
        <Popover.Root open={open} onOpenChange={changeOpen}>
          <Popover.Trigger>{trigger}</Popover.Trigger>
          <PopoverContent>{content}</PopoverContent>
        </Popover.Root>
      )}
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  width: 100%;
  align-items: center;
  ${(p) => p.theme.breakpoints.up('md')} {
    &[data-inline-label] {
      grid-template-columns: var(--select-label-width) minmax(0, 1fr);
      gap: var(--space-5);
    }
  }
`
const Label = styled.label`
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
  font-weight: 500;
`
const Trigger = styled.button`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
  /* Match Input's size 2; the phone rule uses size 3. */
  height: var(--space-6);
  min-height: 0;
  padding: 0 var(--space-2);
  border: 1px solid var(--gray-a7);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  color: var(--gray-12);
  font: inherit;
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
  text-align: left;
  &:hover:not(:disabled) {
    border-color: var(--gray-a9);
  }
  &:focus-visible {
    outline: 2px solid var(--ds-accent-8);
    outline-offset: 2px;
  }
  &[data-placeholder] {
    color: var(--gray-a10);
  }
  &[aria-invalid='true'] {
    border-color: var(--red-8);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  ${(p) => p.theme.breakpoints.down('md')} {
    height: var(--space-7);
    padding-inline: var(--space-3);
    font-size: var(--font-size-3);
    line-height: var(--line-height-3);
  }
`
const Value = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const PopoverContent = styled(Popover.Content)`
  z-index: 60;
  min-width: var(--radix-popover-trigger-width);
  max-width: min(360px, calc(100vw - var(--space-7)));
  padding: var(--space-1);
`
const MenuTitle = styled.div`
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-1);
  color: var(--gray-11);
`
const MenuList = styled(ListBox)`
  display: grid;
  gap: var(--space-1);
  max-height: var(--select-menu-height);
  overflow-y: auto;
  outline: none;
`
const MenuItem = styled(ListBoxItem)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  color: var(--gray-12);
  cursor: pointer;
  outline: none;
  &[data-hovered],
  &[data-focused] {
    background: var(--ds-neutral-alpha-3);
  }
  &[data-focus-visible] {
    outline: 2px solid var(--ds-accent-8);
    outline-offset: -2px;
  }
  &[aria-selected='true'] {
    background: var(--ds-accent-3);
    color: var(--ds-accent-11);
  }
  ${(p) => p.theme.breakpoints.down('md')} {
    min-height: var(--space-8);
  }
`
const ItemLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const ItemCheck = styled(CheckIcon)`
  width: var(--space-4);
  height: var(--space-4);
  opacity: 0;
  &[data-visible] {
    opacity: 1;
  }
`

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@radix-ui/react-icons'
import { Popover } from '@radix-ui/themes'
import {
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { ListBox, ListBoxItem } from 'react-aria-components'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useBreakpoint } from '../hooks'

import { Button } from './button/ui/button'
import { Drawer } from './dialogs/ui/drawer'
import { Hint } from './hint'

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
  /** Keep the associated accessible label without a visible line above. */
  labelHidden?: boolean
  /** Explains the label in a question-mark tooltip beside it. */
  hint?: string
  allSelectedText?: string
  inputProps?: InputProps
  menuMaxHeight?: string | number
  /** Before the value: what the field picks, at a glance. */
  icon?: ReactNode
  /** The trigger's text in place of the chosen labels, e.g. with its dates. */
  valueText?: string
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
  labelHidden,
  hint,
  allSelectedText,
  inputProps,
  menuMaxHeight,
  icon,
  valueText,
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
      data-icon={icon ? true : undefined}
      style={inputProps?.style}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          changeOpen(true)
        }
      }}
    >
      {icon ? <Icon aria-hidden>{icon}</Icon> : null}
      <Value>{valueText ?? (buttonText || ph)}</Value>
      {open ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
    </Trigger>
  )

  return (
    <Root
      className={className}
      data-label-hidden={labelHidden || undefined}
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
      {label ? (
        <Label htmlFor={id}>
          {label}
          {hint && <Hint content={hint} size={13} />}
        </Label>
      ) : null}
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
  gap: var(--ui-space-2);
  min-width: 0;
  width: 100%;
  align-items: center;
  ${(p) => p.theme.breakpoints.up('md')} {
    &[data-inline-label] {
      grid-template-columns: var(--select-label-width) minmax(0, 1fr);
      gap: var(--ui-space-5);
    }
  }
`
const Label = styled.label`
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: 500;

  ${Root}[data-label-hidden] & {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`
const Trigger = styled.button`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-2);
  width: 100%;
  min-width: 0;
  /* Match Input's size 2; the phone rule uses size 3. */
  height: var(--select-trigger-height, var(--ui-space-6));
  min-height: 0;
  padding: 0 var(--select-trigger-padding, var(--ui-space-2));
  border: 1px solid var(--select-trigger-border, var(--ui-line));
  border-radius: var(--select-trigger-radius, var(--ui-row-radius));
  background: var(--select-trigger-background, var(--ui-surface));
  color: var(--select-trigger-color, var(--ui-text));
  font: inherit;
  font-size: var(--select-trigger-font-size, var(--ui-meta-size));
  line-height: var(--ui-meta-line-height);
  text-align: left;
  &[data-icon] {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  &:hover:not(:disabled) {
    border-color: var(--select-trigger-hover-border, var(--ui-muted));
    background: var(
      --select-trigger-hover-background,
      var(--select-trigger-background, var(--ui-surface))
    );
  }
  &:focus-visible {
    outline: var(--ui-focus-width, 2px) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset, 2px);
  }
  &[data-placeholder] {
    color: var(--select-trigger-color, var(--ui-muted));
  }
  &[aria-invalid='true'] {
    border-color: var(--ui-field-border-invalid, var(--red-8));
  }
  &:disabled {
    background: var(--ui-field-background-locked, var(--ui-inset));
    color: var(--ui-muted);
    cursor: not-allowed;
  }
  ${(p) => p.theme.breakpoints.down('md')} {
    height: var(--select-trigger-height, var(--ui-space-7));
    padding-inline: var(--ui-space-3);
    font-size: var(--select-trigger-font-size, var(--ui-body-size));
    line-height: var(--ui-body-line-height);
  }
`
const Icon = styled.span`
  display: grid;
  place-items: center;
  color: var(--ui-muted);
`
const Value = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const PopoverContent = styled(Popover.Content)`
  /* A column, so the empty focus-guard spans around the list take no line. */
  display: flex;
  flex-direction: column;
  z-index: 60;
  min-width: var(--radix-popover-trigger-width);
  max-width: min(360px, calc(100vw - var(--ui-space-7)));
  padding: var(--ui-space-1);
`
const MenuTitle = styled.div`
  padding: var(--ui-space-2) var(--ui-space-3);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  color: var(--ui-muted);
`
const MenuList = styled(ListBox)`
  display: grid;
  gap: 2px;
  max-height: var(--select-menu-height);
  overflow-y: auto;
  outline: none;
`
const MenuItem = styled(ListBoxItem)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-2);
  /* Match the trigger's text; the phone rule keeps a touch-sized row. */
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-row-radius);
  color: var(--ui-text);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  cursor: pointer;
  outline: none;
  &[data-hovered],
  &[data-focused] {
    background: var(--ui-inset);
  }
  &[data-focus-visible] {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: calc(-1 * var(--ui-focus-width));
  }
  &[aria-selected='true'] {
    background: var(--ui-glow);
    color: var(--ui-blue);
  }
  ${(p) => p.theme.breakpoints.down('md')} {
    min-height: var(--ui-space-8);
    font-size: var(--ui-body-size);
    line-height: var(--ui-body-line-height);
  }
`
const ItemLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const ItemCheck = styled(CheckIcon)`
  width: var(--ui-space-4);
  height: var(--ui-space-4);
  opacity: 0;
  &[data-visible] {
    opacity: 1;
  }
`

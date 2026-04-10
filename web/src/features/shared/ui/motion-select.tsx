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

import { useBreakpoints } from '../hooks'

import { Button } from './button'
import { Checkbox } from './checkbox'
import { Drawer } from './dialogs/drawer'
import { Input } from './input'
import { Text } from './text'

type Option = {
  value: string
  label: string
}

type MotionSelectProps = {
  className?: string
  options: Option[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  placeholder?: string
  multi?: boolean
  title?: string
  label?: string
  allSelectedText?: string
}

export const MotionSelect = ({
  className,
  options,
  value,
  onChange,
  placeholder,
  multi,
  title,
  label,
  allSelectedText,
}: MotionSelectProps) => {
  const { t } = useTranslation()
  const { isMobile, isDesktop } = useBreakpoints()
  const [open, setOpen] = useState(false)

  const ph = placeholder ?? t('ui.motionSelect.placeholder')

  const selectedSet = useMemo(() => {
    const arr = Array.isArray(value) ? value : value ? [value] : []
    return new Set(arr)
  }, [value])

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

    return labels.join(', ')
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

      <MenuList>
        {options.map((o) => {
          const checked = selectedSet.has(o.value)

          return (
            <MenuItem
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
            >
              {isDesktop && multi && <Checkbox checked={checked} />}
              <Text size={'3'}>{o.label}</Text>
              {isMobile && multi && checked && <CheckIcon aria-hidden="true" />}
            </MenuItem>
          )
        })}
      </MenuList>
    </>
  )

  const TriggerEl = (
    <span style={{ width: '100%' }}>
      <Input
        className={className}
        label={label}
        addonRight={open ? <ChevronUpIcon /> : <ChevronDownIcon />}
        value={buttonText ? buttonText : ''}
        columns={'1fr'}
        readOnly={false}
        onChange={() => {}}
        disabled={false}
        placeholder={ph}
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      />
    </span>
  )

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={title ?? ph}
        trigger={TriggerEl}
        description={
          <Button stretch themeVariant="primary" onClick={() => setOpen(false)}>
            {t('common.apply', 'Apply')}
          </Button>
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
  width: var(--radix-popover-trigger-width);
  outline: none;
  padding: var(--space-2);
`

const MenuTitle = styled.div`
  padding: var(--space-2) var(--space-3);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(0, 5, 29, 0.55);
`

const MenuList = styled.div`
  display: flex;
  flex-direction: column;
`

const MenuItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
  padding: 12px;

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }

  ${(p) => p.theme.breakpoints.up('md')} {
    padding: 6px 12px;
    border-radius: 8px;
    justify-content: flex-start;
  }
`

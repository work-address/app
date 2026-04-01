import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

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
}

function ChevronDownIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const MotionSelect = ({
  className,
  options,
  value,
  onChange,
  placeholder = 'Select',
  multi,
  title,
}: MotionSelectProps) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el) {
        return
      }
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selectedSet = useMemo(() => {
    if (Array.isArray(value)) {
      return new Set(value)
    }
    return new Set(value ? [value] : [])
  }, [value])

  const buttonText = useMemo(() => {
    if (multi) {
      if (selectedSet.size === 0) {
        return placeholder
      }
      if (selectedSet.size === options.length) {
        return placeholder
      }
      const labels = options
        .filter((o) => selectedSet.has(o.value))
        .map((o) => o.label)
      return labels.join(', ')
    }

    const v = Array.isArray(value) ? value[0] : value
    const found = options.find((o) => o.value === v)
    return found?.label ?? placeholder
  }, [multi, options, placeholder, selectedSet, value])

  const toggle = (v: string) => {
    if (!multi) {
      onChange(v)
      setOpen(false)
      return
    }

    const next = new Set(selectedSet)
    if (next.has(v)) {
      next.delete(v)
    } else {
      next.add(v)
    }
    onChange([...next])
  }

  return (
    <Root ref={rootRef} className={className}>
      <Trigger
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
      >
        <TriggerText title={buttonText}>{buttonText}</TriggerText>
        <TriggerIcon $open={open}>
          <ChevronDownIcon />
        </TriggerIcon>
      </Trigger>

      <AnimatePresence>
        {open ? (
          <MenuWrap
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            {title ? <MenuTitle>{title}</MenuTitle> : null}
            <MenuList>
              {options.map((o) => {
                const checked = selectedSet.has(o.value)
                return (
                  <MenuItem
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                  >
                    {multi ? (
                      <Checkbox aria-hidden="true" $checked={checked} />
                    ) : null}
                    <ItemLabel>{o.label}</ItemLabel>
                  </MenuItem>
                )
              })}
            </MenuList>
          </MenuWrap>
        ) : null}
      </AnimatePresence>
    </Root>
  )
}

const Root = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;
  --ms-height: 40px;
`

const Trigger = styled.button`
  width: 100%;
  height: var(--ms-height);
  border-radius: 4px;
  border: 1px solid rgba(0, 8, 48, 0.12);
  padding: 0 10px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: rgba(0, 52, 130, 0.55);
  }
`

const TriggerText = styled.span`
  font-size: 14px;
  color: rgba(0, 5, 29, 0.45);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: clip;
`

const TriggerIcon = styled.span<{ $open?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 5, 29, 0.62);
  transition: transform 0.14s ease;
  transform: rotate(${(p) => (p.$open ? '180deg' : '0deg')});
`

const MenuWrap = styled(motion.div)`
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  z-index: 60;
  width: 100%;
  background: #fff;
  border: 1px solid rgba(0, 8, 48, 0.12);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
`

const MenuTitle = styled.div`
  padding: 14px 14px 10px;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(0, 5, 29, 0.55);
`

const MenuList = styled.div`
  padding: 6px;
  display: flex;
  flex-direction: column;
`

const MenuItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 12px;
  border-radius: 12px;
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }
`

const Checkbox = styled.span<{ $checked?: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(0, 8, 48, 0.18);
  background: ${(p) => (p.$checked ? '#3f67a4' : '#fff')};
  box-shadow: ${(p) =>
    p.$checked ? 'inset 0 0 0 1px rgba(63, 103, 164, 0.25)' : 'none'};
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 10px;
    height: 6px;
    border-left: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: translate(-50%, -60%) rotate(-45deg);
    opacity: ${(p) => (p.$checked ? 1 : 0)};
  }
`

const ItemLabel = styled.span`
  font-size: 14px;
  line-height: 24px;
  font-weight: 500;
  color: #1c2024;
`

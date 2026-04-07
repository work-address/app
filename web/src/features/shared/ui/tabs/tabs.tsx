import * as RadixTabs from '@radix-ui/react-tabs'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

export const TabsRoot = ({ children, ...props }: RadixTabs.TabsProps) => {
  return <StyledTabsRoot {...props}>{children}</StyledTabsRoot>
}

export const TabsList = ({ children, ...props }: RadixTabs.TabsListProps) => {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = useState({ x: 0, width: 0, visible: false })

  useEffect(() => {
    const list = listRef.current

    if (!list) {
      return
    }

    const updateIndicator = () => {
      const activeTrigger = list.querySelector<HTMLElement>(
        "[data-state='active']",
      )

      if (!activeTrigger) {
        setIndicator((prev) => ({ ...prev, visible: false }))
        return
      }

      const listRect = list.getBoundingClientRect()
      const triggerRect = activeTrigger.getBoundingClientRect()

      setIndicator({
        x: triggerRect.left - listRect.left,
        width: triggerRect.width,
        visible: true,
      })
    }

    updateIndicator()

    const observer = new MutationObserver(updateIndicator)

    observer.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    })

    window.addEventListener('resize', updateIndicator)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [])

  return (
    <StyledTabsList ref={listRef} {...props}>
      {children}
      {indicator.visible ? (
        <ActiveTabIndicator
          aria-hidden="true"
          animate={{ x: indicator.x, width: indicator.width, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        />
      ) : null}
    </StyledTabsList>
  )
}

export const TabsTrigger = ({
  value,
  children,
  ...props
}: RadixTabs.TabsTriggerProps) => {
  return (
    <StyledTabsTrigger value={value} {...props}>
      {children}
    </StyledTabsTrigger>
  )
}

export const TabsContent = ({
  children,
  value,
  ...props
}: RadixTabs.TabsContentProps) => {
  return (
    <RadixTabs.Content value={value} {...props}>
      {children}
    </RadixTabs.Content>
  )
}

const StyledTabsRoot = styled(RadixTabs.Root)``

const StyledTabsList = styled(RadixTabs.List)`
  display: flex;
  gap: var(--space-3);
  position: relative;
`

const StyledTabsTrigger = styled(RadixTabs.TabsTrigger)`
  font-weight: 400;
  color: var(--gray-10);
  position: relative;
  z-index: 1;
  padding: 0 var(--space-2);

  &[data-state='active'] {
    font-weight: 500;
    color: var(--ds-neutral-12);
  }
`

const ActiveTabIndicator = styled(motion.div)`
  position: absolute;
  left: 0;
  bottom: -8px;
  height: 2px;
  background: var(--ds-primary);
  pointer-events: none;
`

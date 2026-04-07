import * as RadixTabs from '@radix-ui/react-tabs'
import styled from 'styled-components'

export const TabsRoot = ({ children, ...props }: RadixTabs.TabsProps) => {
  return <StyledTabsRoot {...props}>{children}</StyledTabsRoot>
}

export const TabsList = ({ children, ...props }: RadixTabs.TabsListProps) => {
  return <StyledTabsList {...props}>{children}</StyledTabsList>
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
`

const StyledTabsTrigger = styled(RadixTabs.TabsTrigger)`
  font-weight: 400;
  color: var(--gray-10);

  &[data-state='active'] {
    font-weight: 500;
    color: var(--ds-neutral-12);
  }
`

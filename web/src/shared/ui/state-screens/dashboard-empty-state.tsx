import styled from 'styled-components'

import type React from 'react'

import { Button, type ButtonProps } from '@/shared'

type DashboardEmptyStateProps = {
  imageSrc: string
  title: string
  description: string
  actionLabel: string
  onAction?: () => void
  className?: string
  style?: React.CSSProperties
  buttonIcon?: React.ReactNode
} & ButtonProps

export const DashboardEmptyState = ({
  imageSrc,
  title,
  description,
  actionLabel,
  onAction,
  className,
  style,
  buttonIcon,
  ...buttonProps
}: DashboardEmptyStateProps) => {
  return (
    <Root className={className} style={style}>
      <Hero>
        <HeroImg src={imageSrc} alt={title} />
      </Hero>
      <Text>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDesc>{description}</EmptyDesc>
      </Text>
      <EmptyAction iconLeft={buttonIcon} {...buttonProps} onClick={onAction}>
        {actionLabel}
      </EmptyAction>
    </Root>
  )
}

const Root = styled.section`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

const Hero = styled.div`
  width: 100%;
  max-width: 800px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 51, 0.02);
`

const HeroImg = styled.img`
  width: 100%;
  height: auto;
  display: block;
`

const Text = styled.div`
  margin-top: var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  max-width: 520px;
`

const EmptyTitle = styled.h3`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  text-align: center;
  color: #1c2024;
`

const EmptyDesc = styled.p`
  max-width: 350px;
  font-weight: 400;
  font-size: 14px;
  line-height: 143%;
  text-align: center;
  color: #60646c;
`

const EmptyAction = styled(Button)`
  margin-top: var(--space-5);
`

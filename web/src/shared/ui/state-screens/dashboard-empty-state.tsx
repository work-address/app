import styled from 'styled-components'

import { Button, type ButtonProps } from '../button'

import { EmptyStateDescription, EmptyStateTitle } from './empty-state-text'

import type React from 'react'

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
        <EmptyStateTitle>{title}</EmptyStateTitle>
        <EmptyStateDescription>{description}</EmptyStateDescription>
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
  max-width: 700px;
  border-radius: 12px;
  /* overflow: hidden; */
  background: var(--c-rgba-0-0-51-0_02);
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

const EmptyAction = styled(Button)`
  margin-top: var(--space-5);
`

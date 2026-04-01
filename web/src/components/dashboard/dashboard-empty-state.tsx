import styled from 'styled-components'

import Button from '@/ui/button'

type DashboardEmptyStateProps = {
  imageSrc: string
  title: string
  description: string
  actionLabel: string
  onAction?: () => void
}

export default function DashboardEmptyState({
  imageSrc,
  title,
  description,
  actionLabel,
  onAction,
}: DashboardEmptyStateProps) {
  return (
    <Root>
      <Hero>
        <HeroImg src={imageSrc} alt={title} />
      </Hero>
      <Text>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDesc>{description}</EmptyDesc>
      </Text>
      <EmptyAction variant="secondary" onClick={onAction}>
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
  padding: 40px 0 10px;
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
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
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
  margin-top: 24px;
  padding: 6px 16px;
  border-radius: 4px;
  height: 32px;
  color: #1c2024;
  font-weight: 500;
  font-size: 14px;
  line-height: 143%;
`

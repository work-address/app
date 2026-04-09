import styled from 'styled-components'

import { Button } from '@/features/shared'

type ProjectsNotFoundProps = {
  title: string
  description: string
  actionLabel: string
  onAction?: () => void
}

export const ProjectsNotFound = ({
  title,
  description,
  actionLabel,
  onAction,
}: ProjectsNotFoundProps) => {
  return (
    <Root>
      <IconInner>
        <img src="/img/icons/featured-icon.svg" alt={title} />
      </IconInner>

      <Title>{title}</Title>

      <Desc>{description}</Desc>

      <Button onClick={onAction} themeVariant={'primary'} size={'2'}>
        {actionLabel}
      </Button>
    </Root>
  )
}

const Root = styled.section`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  text-align: center;
`

const IconInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;

  img {
    width: 60px;
    height: 60px;
    display: block;
  }
`

const Title = styled.div`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  margin-bottom: 6px;
`

const Desc = styled.div`
  max-width: 352px;
  font-size: 14px;
  line-height: 143%;
  color: #60646c;
  margin-bottom: 24px;
`

import { useEffect, useState } from 'react'
import { useLocation, useViewTransitionState } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'

type PageIndicatorProps = {
  className?: string
}

export const PageIndicator = ({ className }: PageIndicatorProps) => {
  const location = useLocation()
  const transition = useViewTransitionState(location.pathname)

  const [animationStarted, setAnimationStarted] = useState(false)

  useEffect(() => {
    if (transition) {
      setAnimationStarted(true)
    }
  }, [transition])

  useEffect(() => {
    if (!transition) {
      const timer = setTimeout(() => {
        setAnimationStarted(false)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [transition])

  return (
    <PageIndicatorContainer className={className}>
      <StyledPageIndicator
        $showAnimation={transition || animationStarted}
        $animationFinished={!transition && animationStarted}
      />
    </PageIndicatorContainer>
  )
}

const pageIndicatorAnimation = keyframes`
  0% {
    transform: translateX(-80%);
  }

  15% {
    transform: translateX(-40%);
  }

  65% {
    transform: translateX(-30%);
  }

  100% {
    transform: translateX(-10%);
  }
`

const finishAnimation = keyframes`
  0% {
    transform: translateX(0%);
    opacity: 1;
  }

  100% {
    transform: translateX(0%);
    opacity: 0;
  }
`

const PageIndicatorContainer = styled.div`
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 11;

  @media print {
    display: none;
  }
`

const StyledPageIndicator = styled.div<{
  $showAnimation: boolean
  $animationFinished: boolean
}>`
  position: absolute;
  transform: translateX(-100%);
  top: 0;

  width: 100%;

  height: 2px;

  ${(p) => p.theme.breakpoints.up('md')} {
    height: 4px;
  }

  background: linear-gradient(to right, transparent, var(--ds-accent-9));

  animation-iteration-count: 0;
  animation-timing-function: ease-out;

  animation-name: ${(p) =>
    p.$animationFinished ? finishAnimation : pageIndicatorAnimation};

  ${(p) =>
    p.$showAnimation &&
    `
      animation-duration: 10s;
      animation-iteration-count: 1;
    `}

  ${(p) =>
    p.$animationFinished &&
    `
      animation-duration: 1s;
      animation-iteration-count: 1;
    `}
`

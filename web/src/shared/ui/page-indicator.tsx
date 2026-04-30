import { useEffect, useState } from 'react'
import { useLocation, useViewTransitionState } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'

export const PageIndicator = () => {
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
    <PageIndicatorContainer>
      <StyledPageIndicator
        $showAnimation={transition || animationStarted}
        $animationFinished={!transition && animationStarted}
      />
    </PageIndicatorContainer>
  )
}

const pageIndicatorAnimation = keyframes`
  0% {
    transform: translateX(-70%);
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
  z-index: 100;
`

const StyledPageIndicator = styled.div<{
  $showAnimation: boolean
  $animationFinished: boolean
}>`
  position: absolute;
  transform: translateX(-100%);
  top: 0;

  width: 100%;
  height: 4px;

  background: linear-gradient(to right, transparent, var(--ds-accent-9));

  animation-iteration-count: 0;
  animation-timing-function: ease-in-out;

  animation-name: ${(p) =>
    p.$animationFinished ? finishAnimation : pageIndicatorAnimation};

  ${(p) =>
    p.$showAnimation &&
    `
      animation-duration: 8s;
      animation-iteration-count: infinite;
    `}

  ${(p) =>
    p.$animationFinished &&
    `
      animation-duration: 1s;
      animation-iteration-count: 1;
    `}
`

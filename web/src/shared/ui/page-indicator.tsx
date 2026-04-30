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

  40% {
    transform: translateX(-45%);
  }

  60% {
    transform: translateX(-40%);
  }

  75% {
    transform: translateX(-30%);
  }

  85% {
    transform: translateX(-20%);
  }

  100% {
    transform: translateX(0);
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
  top: 0;
  transform: translateY(-100%);

  width: 100%;
  height: 3px;

  animation-name: ${pageIndicatorAnimation};

  animation-duration: 5s;
  animation-iteration-count: 0;
  animation-timing-function: ease-in-out;

  background: linear-gradient(to right, transparent, var(--ds-accent-9));
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.3s ease-in-out,
    visibility 0.3s ease-in-out;

  ${(p) =>
    p.$showAnimation &&
    `
      animation-iteration-count: infinite;
      visibility: visible;
      opacity: 1;
    `}

  ${(p) =>
    p.$animationFinished &&
    `
      transform: translateX(0) !important;
    `}
`

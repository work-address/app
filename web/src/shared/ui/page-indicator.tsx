import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useLocation, useViewTransitionState } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'

import { $pageBusy } from '../model/page-busy.model'

export type PageIndicatorState = 'idle' | 'running' | 'finished'

type PageIndicatorProps = {
  className?: string
}

export const PageIndicator = ({ className }: PageIndicatorProps) => {
  const location = useLocation()
  const transition = useViewTransitionState(location.pathname)
  const busy = useUnit($pageBusy)
  const active = transition || busy

  const [animationStarted, setAnimationStarted] = useState(false)

  useEffect(() => {
    if (active) {
      setAnimationStarted(true)
    }
  }, [active])

  useEffect(() => {
    if (!active) {
      const timer = setTimeout(() => {
        setAnimationStarted(false)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [active])

  const showAnimation = active || animationStarted
  const animationFinished = !active && animationStarted

  const state: PageIndicatorState = animationFinished
    ? 'finished'
    : showAnimation
      ? 'running'
      : 'idle'

  return (
    <Root className={className}>
      <Bar data-state={state} />
    </Root>
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

const Root = styled.div`
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 11;

  @media print {
    display: none;
  }
`

const Bar = styled.div`
  position: absolute;
  transform: translateX(-100%);
  top: 0;

  width: 100%;

  height: 2px;

  ${(p) => p.theme.breakpoints.up('md')} {
    height: 4px;
  }

  background: linear-gradient(to right, transparent, var(--ui-blue));

  animation-iteration-count: 0;
  animation-timing-function: ease-out;

  &[data-state='running'] {
    animation-name: ${pageIndicatorAnimation};
    animation-duration: 10s;
    animation-iteration-count: 1;
    /* A slow reload outlasts the climb; the bar waits at the top of it rather
       than vanishing while the data is still on its way. */
    animation-fill-mode: forwards;
  }

  &[data-state='finished'] {
    animation-name: ${finishAnimation};
    animation-duration: 1s;
    animation-iteration-count: 1;
  }
`

import styled, { keyframes } from 'styled-components'

import type { CSSProperties } from 'react'

type SpinnerProps = {
  size?: number
  style?: CSSProperties
}

export const Spinner = ({ size, style }: SpinnerProps) => (
  <SpinnerRing size={size} style={style} />
)

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const SpinnerRing = styled.div<Pick<SpinnerProps, 'size'>>`
  width: ${({ size = 24 }) => size}px;
  height: ${({ size = 24 }) => size}px;
  border-radius: 50%;
  border: ${({ size = 24 }) => size / 16}px solid var(--ds-neutral-alpha-6);
  border-top-color: var(--accent-10);
  animation: ${spin} 0.7s linear infinite;
`

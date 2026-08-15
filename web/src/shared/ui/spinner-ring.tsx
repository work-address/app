import styled, { keyframes } from 'styled-components'

import type { CSSProperties } from 'react'

type SpinnerProps = {
  size?: number
  color?: string
  width?: string
  style?: CSSProperties
  useCase?: 'button'
}

export const Spinner = ({
  size,
  style,
  color,
  width,
  useCase,
}: SpinnerProps) => {
  return (
    <Root
      size={size}
      style={style}
      $color={color}
      $width={width}
      {...(useCase === 'button'
        ? { size: 12, $color: 'var(--white)', $width: '2px' }
        : null)}
    />
  )
}

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const Root = styled.div<
  Pick<SpinnerProps, 'size'> & { $color?: string; $width?: string }
>`
  width: ${({ size = 24 }) => size}px;
  height: ${({ size = 24 }) => size}px;
  border-radius: 50%;
  border: ${({ size = 24, $width }) => $width || `${size / 16}px`} solid
    var(--ds-neutral-alpha-6);
  border-top-color: ${({ $color }) => $color || 'var(--ds-accent-11)'};
  animation: ${spin} 0.7s linear infinite;
`

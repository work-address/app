import styled from 'styled-components'

import type { CSSProperties, ReactNode } from 'react'

export type CardProps = {
  className?: string
  children?: ReactNode
  style?: CSSProperties
  shadow?: boolean
  rounded?: boolean
}

export const Card = ({
  shadow = true,
  rounded = true,
  ...props
}: CardProps) => {
  return <Layer $shadow={shadow} $rounded={rounded} {...props} />
}

const Layer = styled.section<{ $rounded: boolean; $shadow: boolean }>`
  /* border: 1px solid var(--ds-neutral-alpha-6); */
  background-color: var(--white);
  padding: var(--spacing-5);

  ${(p) => p.$rounded && `border-radius: var(--radius-4);`}

  ${(p) => p.$shadow && `box-shadow: var(--shadow-4);`}
`

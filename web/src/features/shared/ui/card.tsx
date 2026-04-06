import styled from 'styled-components'

import type { CSSProperties, ReactNode } from 'react'

export type CardProps = {
  className?: string
  children?: ReactNode
  style?: CSSProperties
  shadow?: boolean
}

export const Card = ({ shadow = true, ...props }: CardProps) => {
  return <Layer shadow={shadow} {...props} />
}

const Layer = styled.section<CardProps>`
  border: 1px solid var(--neutral-alpha-6);
  border-radius: var(--radius-4);
  background-color: var(--white);
  padding: var(--spacing-5);

  ${(p) => p.shadow && `box-shadow: var(--shadow-4);`}
`

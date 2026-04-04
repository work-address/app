import styled from 'styled-components'

import type { CSSProperties, ReactNode } from 'react'

export type CardProps = {
  className?: string
  children?: ReactNode
  style?: CSSProperties
}

export const Card = (props: CardProps) => {
  return <Layer {...props} />
}

const Layer = styled.section<CardProps>`
  border: 1px solid var(--neutral-alpha-6);
  border-radius: var(--radius-4);
  background-color: var(--white);
  box-shadow: var(--shadow-4);
  padding: var(--spacing-5);
`

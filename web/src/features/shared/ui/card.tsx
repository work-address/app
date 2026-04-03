import styled from 'styled-components'

import type { ReactNode } from 'react'

type CardProps = {
  className?: string
  children?: ReactNode
}

export const Card = ({ className, children }: CardProps) => {
  return <Layer className={className}>{children}</Layer>
}

const Layer = styled.section`
  border: 1px solid var(--neutral-alpha-6);
  border-radius: var(--radius-4);
  background-color: var(--white);
  box-shadow: var(--shadow-4);
  padding: var(--spacing-5);
`

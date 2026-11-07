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
  // Off unless asked for: the page body carries no shadows, and a card there
  // draws its edge with a hairline border.
  shadow = false,
  rounded = true,
  ...props
}: CardProps) => {
  return (
    <Root
      data-rounded={rounded || undefined}
      data-shadow={shadow || undefined}
      {...props}
    />
  )
}

const Root = styled.section`
  /* border: 1px solid var(--ui-line); */
  background-color: var(--ui-surface);
  padding: var(--ui-space-5);

  &[data-rounded] {
    border-radius: var(--ui-control-radius);
  }

  &[data-shadow] {
    box-shadow: var(--ui-shadow);
  }
`

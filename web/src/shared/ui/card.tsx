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
  return (
    <Root
      data-rounded={rounded || undefined}
      data-shadow={shadow || undefined}
      {...props}
    />
  )
}

const Root = styled.section`
  /* border: 1px solid var(--ds-neutral-alpha-6); */
  background-color: var(--white);
  padding: var(--spacing-5);

  &[data-rounded] {
    border-radius: var(--radius-4);
  }

  &[data-shadow] {
    box-shadow: var(--shadow-4);
  }
`

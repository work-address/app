import { Text as RadixText } from '@radix-ui/themes'
import styled from 'styled-components'

import type { TextProps as RadixTextProps } from '@radix-ui/themes'

type TextProps = {
  themeVariant?: 'primary' | 'secondary'
  letterSpacing?: string
} & RadixTextProps

export const Text = ({ ...props }: TextProps) => {
  return <StyledRadixText {...props} />
}

const StyledRadixText = styled(RadixText)<TextProps>`
  ${(p) =>
    p.themeVariant === 'primary' &&
    `
      color: var(--ds-accent-11);
    `}

  ${(p) =>
    p.letterSpacing &&
    `
      letter-spacing: ${p.letterSpacing};
  `}
`

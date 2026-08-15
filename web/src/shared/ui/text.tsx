import { Text as RadixText } from '@radix-ui/themes'
import styled from 'styled-components'

import type { TextProps as RadixTextProps } from '@radix-ui/themes'

export type TextThemeVariant = 'primary' | 'secondary'

type TextProps = {
  $themeVariant?: TextThemeVariant
  $letterSpacing?: string
} & RadixTextProps

export const Text = ({ $themeVariant, ...props }: TextProps) => {
  return <Root data-theme-variant={$themeVariant} {...props} />
}

const Root = styled(RadixText)<Pick<TextProps, '$letterSpacing'>>`
  &[data-theme-variant='primary'] {
    color: var(--ds-accent-11);
  }

  ${(p) =>
    p.$letterSpacing &&
    `
      letter-spacing: ${p.$letterSpacing};
  `}
`

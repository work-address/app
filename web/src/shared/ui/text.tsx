import { Text as RadixText } from '@radix-ui/themes'
import styled from 'styled-components'

import type { TextProps as RadixTextProps } from '@radix-ui/themes'

export type TextThemeVariant = 'primary' | 'secondary'

type TextProps = {
  $themeVariant?: TextThemeVariant
  $letterSpacing?: string
} & RadixTextProps

/**
 * Radix Text with the brand colour variants.
 *
 * `as` is handed to Radix as `forwardedAs`, never to styled-components: on a
 * styled component `as` replaces the wrapped component itself, so
 * `<Text as="label" size="2">` used to render a bare <label> with none of
 * the size, weight or colour it was given - every form label and stat caption
 * in the app came out at the browser's 16px default.
 */
export const Text = ({ $themeVariant, as, ...props }: TextProps) => {
  return <Root data-theme-variant={$themeVariant} forwardedAs={as} {...props} />
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

import { IconButton as RadixIconButton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { IconButtonProps as RadixIconButtonProps } from '@radix-ui/themes'

type IconButtonProps = {
  themeVariant?: 'primary' | 'secondary'
} & RadixIconButtonProps

export const IconButton = ({ ...props }: IconButtonProps) => {
  return <StyledRadixIconButton {...props} />
}

const StyledRadixIconButton = styled(RadixIconButton)<IconButtonProps>`
  ${(p) =>
    p.themeVariant === 'primary' &&
    `
    background-color: var(--ds-accent-9);
  `}
`

import { Checkbox as RadixCheckbox } from '@radix-ui/themes'
import styled from 'styled-components'

export const Checkbox = styled(RadixCheckbox)`
  &[data-state='checked'],
  &[data-state='indeterminate'] {
    &:before {
      background-color: var(--ds-accent-9);
    }
  }
`

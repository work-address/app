import styled from 'styled-components'

import { Card } from './card'

export const WidePageCard = styled(Card)`
  padding: 20px var(--ui-space-3);

  ${(p) => p.theme.breakpoints.up('md')} {
    width: 1196px;
    margin: var(--ui-space-5) auto;
  }
`

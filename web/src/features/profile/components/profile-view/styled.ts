import styled from 'styled-components'

import type { CardProps } from '@/features/shared'

import { Card } from '@/features/shared'

export const ProfileViewCard = styled(Card)<CardProps & { gridArea?: string }>`
  ${(p) => p.gridArea && `grid-area: ${p.gridArea};`}

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 16px;
  }
`

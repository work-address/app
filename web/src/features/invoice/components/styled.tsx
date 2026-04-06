import styled from 'styled-components'

import { Card } from '@/features/shared'

export const InvoiceCard = styled(Card)`
  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 12px;
  }
`

export const QrCodeImage = styled.img`
  width: 194px;
`

import styled from 'styled-components'

import { Card } from '@/shared'

export const BalanceSectionCard = styled(Card)`
  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 16px;
  }
`

export const QrPlaceholder = styled.div`
  width: 180px;
  height: 180px;
  border: 1px dashed var(--ds-neutral-alpha-8);
  border-radius: var(--radius-3);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ds-neutral-alpha-2);
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  text-align: center;
  padding: 8px;
`

export const AddressBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-3);
  background: var(--ds-neutral-alpha-2);
  word-break: break-all;
  font-family: var(--code-font-family, monospace);
  font-size: 13px;
  line-height: 18px;
  color: var(--ds-neutral-12);
`

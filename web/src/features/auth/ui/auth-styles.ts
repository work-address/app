import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { Card } from '@/shared'

export const Logo = styled.img`
  width: auto;
  display: block;
  height: 80px;
  margin-bottom: 28px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    height: 40px;
    margin-bottom: 40px;
  }
`

/* A white workspace panel on the canvas. */
export const SignInCard = styled(Card)`
  position: relative;
  text-align: center;
  padding: var(--ui-space-6) var(--ui-card-inset-mobile);
  border: var(--ui-border-width) solid var(--ui-edge);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  /* Doubled: Card's own [data-rounded] corner outranks a single class. */
  && {
    border-radius: var(--ui-radius);
  }

  ${({ theme }) => theme.breakpoints.up('md')} {
    width: 600px;
    padding: var(--ui-space-7) var(--ui-space-8) var(--ui-space-6);
  }
`

/* Set like the sign-in page's heading, so the two auth screens a person
   meets in a row read as one product. */
export const Title = styled.h1`
  font-size: var(--ui-title-mobile-size);
  font-weight: var(--ui-title-weight);
  line-height: var(--ui-title-mobile-line-height);
  letter-spacing: var(--ui-title-tracking);
  color: var(--ui-ink);
  margin: 0 0 var(--ui-space-2);
`

export const Desc = styled.p`
  font-weight: var(--ui-weight-regular);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  margin-bottom: var(--ui-space-5);
  color: var(--ui-muted);

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: var(--ui-body-size);
    line-height: var(--ui-body-line-height);
    margin-bottom: var(--ui-space-6);
  }
`

export const MobileBreak = styled.br`
  ${({ theme }) => theme.breakpoints.up('md')} {
    display: none;
  }
`

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 18px;
  gap: 12px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-bottom: 34px;
    gap: 16px;
  }
`

export const Learn = styled(Link)`
  color: var(--ui-blue);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    color: var(--ui-blue);
  }
`
export const FootLine = styled.div`
  margin-top: 14px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-top: 21px;
  }
`

export const FootLabel = styled.span`
  color: var(--ui-muted);
`

export const FootWalletLink = styled.a`
  color: inherit;
  text-decoration: none;

  &:hover {
    color: var(--ui-blue);
    text-decoration: underline;
  }
`

export const ButtonRow = styled.div`
  display: none;
`

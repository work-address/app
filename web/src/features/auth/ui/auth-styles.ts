import { Flex } from '@radix-ui/themes'
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

export const SignInCard = styled(Card)`
  position: relative;
  text-align: center;
  background-color: var(--ds-accent-3);
  padding: var(--spacing-5) 16px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    width: 600px;
    padding: 42px 48px 30px 48px;
    background: var(--c-rgba-255-255-255-0_92);
  }
`

export const Title = styled.h1`
  font-weight: 500;
  letter-spacing: 0.45px;
  font-size: 20px;
  margin-bottom: 12px;
  color: var(--ds-accent-11);
  line-height: 28px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: 35px;
    color: var(--ds-neutral-12);
    line-height: 150%;
    margin-bottom: 5px;
    letter-spacing: 1.15px;
  }
`

export const Desc = styled.p`
  font-weight: 400;
  font-size: 14px;
  margin-bottom: 24px;
  color: var(--ds-accent-11);
  line-height: 20px;
  letter-spacing: 0.34px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    letter-spacing: 0.6px;
    font-size: 16px;
    margin-bottom: 40px;
    color: var(--c-rgba-0-7-20-0_62);
    line-height: 150%;
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
  color: var(--ds-accent-9);
  font-weight: 500;
  padding: 6px 0 0;
  letter-spacing: 0.5px;
  font-size: 14px;

  &:hover {
    text-decoration: underline;
  }

  ${({ theme }) => theme.breakpoints.up('md')} {
    line-height: 150%;
    font-size: 16px;
  }
`
export const FootLine = styled.div`
  margin-top: 14px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-top: 21px;
  }
`

export const FootLabel = styled.span`
  font-weight: 300;
`

export const FootWalletLink = styled.a`
  color: inherit;
  text-decoration: none;

  &:hover {
    color: var(--ds-accent-9);
    text-decoration: underline;
  }
`

export const ButtonRow = styled.div`
  display: none;
`

export const Overlay = styled(Flex)`
  position: absolute;
  background: var(--c-rgba-255-255-255-0_5);
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`

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
    background: rgba(255, 255, 255, 0.92);
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
    color: #1c2024;
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
    color: rgba(0, 7, 20, 0.62);
    line-height: 150%;
  }
`

export const descSpan = styled.span`
  display: inline;

  &:after {
    content: ' ';
    display: inline;
  }

  ${({ theme }) => theme.breakpoints.up('md')} {
    display: block;

    &:after {
      display: none;
    }
  }
`

export const Desc1Row = styled(descSpan)`
  ${({ theme }) => theme.breakpoints.up('md')} {
    letter-spacing: 0.6px;
  }
`

export const Desc2Row = styled(descSpan)`
  ${({ theme }) => theme.breakpoints.up('md')} {
    letter-spacing: 0.4px;
  }
`

export const Desc3Row = styled(descSpan)`
  ${({ theme }) => theme.breakpoints.up('md')} {
    letter-spacing: 0.45px;
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
  color: #3f67a4;
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

export const Foot = styled.footer`
  text-align: center;
  font-size: 12px;
  color: rgba(0, 7, 20, 0.52);
  letter-spacing: 0.55px;
  font-weight: 500;
  margin-left: -2px;
  margin-top: 20px;
  line-height: 16px;
  padding-bottom: 40px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: 14px;
    margin-top: 20px;
    line-height: 20px;
  }
`

export const DesktopBreak = styled.br`
  display: none;

  ${({ theme }) => theme.breakpoints.up('md')} {
    display: block;
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

export const CommitSha = styled.div`
  margin-top: 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 400;
  color: rgba(0, 7, 20, 0.38);
  letter-spacing: 0.2px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-top: 21px;
    font-size: 12px;
  }
`

export const HiddenButtonRow = styled.div`
  display: none;
`

export const FlexOverlay = styled(Flex)`
  position: absolute;
  background: rgba(255, 255, 255, 0.5);
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`

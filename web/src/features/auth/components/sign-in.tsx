import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled from 'styled-components'
import { useTheme } from 'styled-components'

import { ProviderButton } from './provider-button'

import { showErrorToast, Button, Card } from '@/features/shared'

export const SignIn = () => {
  const navigate = useNavigate()
  const { breakpoints } = useTheme()

  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const onSignIn = (type: 'ton' | 'eth') => {
    if (type === 'ton') {
      navigate('/dashboard')
    } else {
      showErrorToast({
        title: 'Connection failed!',
        message: (
          <>
            We couldn&apos;t detect your Ethereum or TON wallet. Please check
            your wallet and try again
          </>
        ),
        position: 'top-center',
      })
    }
  }

  return (
    <Stage>
      <StageContainer>
        {isUpMd ? (
          <Logo src="/img/photo/logo.svg" alt="work-address" />
        ) : (
          <Logo src="/img/photo/logo.svg" alt="work-address" />
        )}

        <SignInCard>
          <Title>Welcome to Work Address</Title>

          <Desc>
            <Desc1Row>
              Join the future of freelancing with <MobileBreak />
              authentication
            </Desc1Row>

            <Desc2Row>
              powered by Ethereum and TON. <MobileBreak />
              Say goodbye to
            </Desc2Row>

            <Desc3Row>passwords and hello to Web3 experiences!</Desc3Row>
          </Desc>

          <Actions>
            <ProviderButton
              iconUrl={'/img/photo/ethereum-logo.svg'}
              iconAlt={'Ethereum'}
              onClick={() => onSignIn('eth')}
            >
              Sign in with Ethereum
            </ProviderButton>

            <ProviderButton
              iconUrl={'/img/photo/ton-logo.svg'}
              iconAlt={'Ton'}
              onClick={() => onSignIn('ton')}
            >
              Sign in with Ton
            </ProviderButton>
          </Actions>

          <Learn href={'#'} target={'_blank'}>
            What is Web3 Wallet?
          </Learn>
        </SignInCard>

        <Foot>
          <FootLine>
            <FootLabel>Ethereum wallets:&nbsp;</FootLabel>
            WalletConnect, Metamask, TrustWallet, Coinbase Wallet,
            <DesktopBreak />
            Atomic Wallet, Exodus Wallet, Exodus Wallet, Edge Wallet, Trezor
            Wallet
          </FootLine>

          <FootLine>
            <FootLabel>TON wallets:&nbsp;</FootLabel>
            Telegram Wallet, Tonkeeper, MyTonWallet, OpenMask,
            <DesktopBreak />
            TonHub, DeWallet, XTONWallet, TON Wallet
          </FootLine>
        </Foot>

        <HiddenButtonRow>
          <Button variant="secondary" onClick={() => onSignIn('eth')}>
            Continue
          </Button>
        </HiddenButtonRow>
      </StageContainer>
    </Stage>
  )
}

const Stage = styled.main`
  min-height: 100vh;
  background: url('/img/photo/sign-bg.webp') center / cover no-repeat;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

const StageContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 16px;
  margin: 10px 0 0 0;

  ${({ theme }) => theme.breakpoints.up('md')} {
    padding: 0;
    margin: 44px 0 0 0;
  }
`

const Logo = styled.img`
  width: auto;
  display: block;
  height: 80px;
  margin-bottom: 28px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    height: 40px;
    margin-bottom: 40px;
  }
`

const SignInCard = styled(Card)`
  text-align: center;
  background-color: var(--accent-3);
  padding: var(--spacing-5) 16px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    width: 600px;
    padding: 42px 48px 30px 48px;
    background: rgba(255, 255, 255, 0.92);
  }
`

const Title = styled.h1`
  font-weight: 500;
  letter-spacing: 0.45px;
  font-size: 20px;
  margin-bottom: 12px;
  color: var(--accent-11);
  line-height: 28px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: 35px;
    color: #1c2024;
    line-height: 150%;
    margin-bottom: 5px;
    letter-spacing: 1.15px;
  }
`

const Desc = styled.p`
  font-weight: 400;
  font-size: 14px;
  margin-bottom: 24px;
  color: var(--accent-11);
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

const descSpan = styled.span`
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

const Desc1Row = styled(descSpan)`
  ${({ theme }) => theme.breakpoints.up('md')} {
    letter-spacing: 0.6px;
  }
`

const Desc2Row = styled(descSpan)`
  ${({ theme }) => theme.breakpoints.up('md')} {
    letter-spacing: 0.4px;
  }
`

const Desc3Row = styled(descSpan)`
  ${({ theme }) => theme.breakpoints.up('md')} {
    letter-spacing: 0.45px;
  }
`

const MobileBreak = styled.br`
  ${({ theme }) => theme.breakpoints.up('md')} {
    display: none;
  }
`

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 18px;
  gap: 12px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-bottom: 34px;
    gap: 16px;
  }
`

const Learn = styled.a`
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

const Foot = styled.footer`
  text-align: center;
  font-size: 12px;
  color: rgba(0, 7, 20, 0.52);
  letter-spacing: 0.55px;
  font-weight: 500;
  margin-left: -2px;
  margin-top: 20px;
  line-height: 16px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: 14px;
    margin-top: 20px;
    line-height: 20px;
  }
`

const DesktopBreak = styled.br`
  display: none;

  ${({ theme }) => theme.breakpoints.up('md')} {
    display: block;
  }
`

const FootLine = styled.div`
  margin-top: 14px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-top: 21px;
  }
`

const FootLabel = styled.span`
  font-weight: 300;
`

const HiddenButtonRow = styled.div`
  display: none;
`

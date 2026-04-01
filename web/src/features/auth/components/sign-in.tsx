import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { ProviderButton } from './provider-button'

import Button from '@/ui/button.tsx'

export const SignIn = () => {
  const navigate = useNavigate()
  const onSignIn = () => () => navigate('/dashboard')

  return (
    <Stage>
      <StageContainer>
        <Logo src="/img/photo/logo.svg" alt="work-address" />

        <Card>
          <Title>Welcome to Work Address</Title>

          <Desc>
            <Desc1Row>
              Join the future of freelancing with authentication
            </Desc1Row>

            <Desc2Row>powered by Ethereum and TON. Say goodbye to</Desc2Row>

            <Desc3Row>passwords and hello to Web3 experiences!</Desc3Row>
          </Desc>

          <Actions>
            <ProviderButton
              iconUrl={'/img/photo/ethereum-logo.svg'}
              iconAlt={'Ethereum'}
            >
              Sign in with Ethereum
            </ProviderButton>

            <ProviderButton iconUrl={'/img/photo/ton-logo.svg'} iconAlt={'Ton'}>
              Sign in with Ton
            </ProviderButton>
          </Actions>

          <Learn href={'#'} target={'_blank'}>
            What is Web3 Wallet?
          </Learn>
        </Card>

        <Foot>
          <FootLine>
            <FootLabel>Ethereum wallets:</FootLabel>
            WalletConnect, Metamask, TrustWallet, Coinbase Wallet, Atomic
            Wallet, Exodus Wallet, Trezor Wallet, Edge Wallet, ZenGo Wallet,
            Crypto Wallet, BitPay Wallet, Opera Wallet
          </FootLine>

          <FootLine>
            <FootLabel>Ton wallets:</FootLabel>
            Telegram Wallet, Tonkeeper, MyTonWallet, OpenMask, TonHub, DeWallet,
            XTONWallet, TON Wallet
          </FootLine>
        </Foot>

        <HiddenButtonRow>
          <Button variant="secondary" onClick={() => onSignIn()}>
            Continue
          </Button>
        </HiddenButtonRow>
      </StageContainer>
    </Stage>
  )
}

export const Stage = styled.main`
  min-height: 100vh;
  background: url('/img/photo/sign-bg.webp') center / cover no-repeat;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

export const StageContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  margin: -8px 0 0 0;
`

export const Logo = styled.img`
  height: 40px;
  width: auto;
  display: block;
  margin-bottom: 40px;
`

export const Card = styled.section`
  width: 600px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 45, 0.09);
  border-radius: 20px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 1px 4px 0 rgba(0, 0, 45, 0.09),
    0 2px 1px -1px rgba(0, 0, 0, 0.05),
    0 1px 3px 0 rgba(0, 0, 0, 0.05);
  padding: 23px 48px 31px 48px;
  text-align: center;
`

export const Title = styled.h1`
  font-weight: 500;
  font-size: 35px;
  line-height: 150%;
  letter-spacing: 1.15px;
  color: #1c2024;
  margin: 20px 0 5px;
`

export const Desc = styled.p`
  font-weight: 400;
  font-size: 16px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.62);
  letter-spacing: 0.6px;
  margin-bottom: 40px;
`

export const Desc1Row = styled.span`
  letter-spacing: 0.6px;
`

export const Desc2Row = styled.span`
  letter-spacing: 0.4px;
`

export const Desc3Row = styled.span`
  letter-spacing: 0.45px;
`

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 35px;
`

export const Learn = styled.a`
  background: transparent;
  border: 0;
  color: #3f67a4;
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  padding: 6px 0 0;
  letter-spacing: 0.5px;

  &:hover {
    text-decoration: underline;
  }
`

export const Foot = styled.footer`
  width: min(680px, 100%);
  text-align: center;
  font-size: 11px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.52);
  margin-top: 18px;
`

export const FootLine = styled.div`
  margin-top: 8px;
`

export const FootLabel = styled.span`
  font-weight: 600;
`

export const HiddenButtonRow = styled.div`
  display: none;
`

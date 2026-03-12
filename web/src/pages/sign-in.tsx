import styled from 'styled-components'
import Button from '../components/ui/button'

type SignInProps = {
  onSignIn?: (provider: 'ethereum' | 'ton') => void
}

export default function SignIn({ onSignIn }: SignInProps) {
  return (
    <Stage>
      <Logo src="/img/photo/logo.svg" alt="work-address" />

      <Card>
        <Title>Welcome to Work Address</Title>
        <Desc>
          Join the future of freelancing with authentication powered by Ethereum and TON.
          Say goodbye to passwords and hello to Web3 experiences!
        </Desc>

        <Actions>
          <ProviderBtn type="button" onClick={() => onSignIn?.('ethereum')}>
            <ProviderIcon src="/img/photo/ethereum-logo.svg" alt="Ethereum" />
            <ProviderText>Sign in with Ethereum</ProviderText>
          </ProviderBtn>

          <ProviderBtn type="button" onClick={() => onSignIn?.('ton')}>
            <ProviderIcon src="/img/photo/ton-logo.svg" alt="Ton" />
            <ProviderText>Sign in with Ton</ProviderText>
          </ProviderBtn>
        </Actions>

        <Learn type="button">What is Web3 Wallet?</Learn>
      </Card>

      <Foot>
        <FootLine>
          <FootLabel>Ethereum wallets:</FootLabel>
          WalletConnect, Metamask, TrustWallet, Coinbase Wallet, Atomic Wallet, Exodus Wallet,
          Trezor Wallet, Edge Wallet, ZenGo Wallet, Crypto Wallet, BitPay Wallet, Opera Wallet
        </FootLine>
        <FootLine>
          <FootLabel>Ton wallets:</FootLabel>
          Telegram Wallet, Tonkeeper, MyTonWallet, OpenMask, TonHub, DeWallet, XTONWallet, TON Wallet
        </FootLine>
      </Foot>

      <HiddenButtonRow>
        <Button variant="secondary" onClick={() => onSignIn?.('ethereum')}>
          Continue
        </Button>
      </HiddenButtonRow>
    </Stage>
  )
}

const Stage = styled.main`
  min-height: 100vh;
  padding: 80px 16px 40px;
  background: url('/img/photo/sign-bg.webp') center / cover no-repeat;
  display: flex;
  flex-direction: column;
  align-items: center;
`

const Logo = styled.img`
  height: 30px;
  width: auto;
  display: block;
  margin-bottom: 22px;
`

const Card = styled.section`
  width: min(520px, 100%);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 45, 0.09);
  border-radius: 14px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 4px 0 rgba(0, 0, 45, 0.09), 0 2px 1px -1px rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  padding: 22px;
  text-align: center;
`

const Title = styled.h1`
  font-weight: 700;
  font-size: 22px;
  line-height: 140%;
  letter-spacing: 0em;
  color: #1c2024;
  margin: 0 0 10px;
`

const Desc = styled.p`
  font-weight: 400;
  font-size: 14px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.62);
  margin: 0 0 16px;
`

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
`

const ProviderBtn = styled.button`
  width: 100%;
  height: 46px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(0, 0, 51, 0.12);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;

  &:hover {
    background: rgba(0, 0, 51, 0.02);
  }
`

const ProviderIcon = styled.img`
  width: 26px;
  height: 26px;
  display: block;
`

const ProviderText = styled.div`
  font-weight: 500;
  font-size: 14px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.82);
`

const Learn = styled.button`
  background: transparent;
  border: 0;
  color: #3f67a4;
  font-weight: 500;
  font-size: 12px;
  line-height: 150%;
  padding: 6px 0 0;

  &:hover {
    text-decoration: underline;
  }
`

const Foot = styled.footer`
  width: min(680px, 100%);
  text-align: center;
  font-size: 11px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.52);
  margin-top: 18px;
`

const FootLine = styled.div`
  margin-top: 8px;
`

const FootLabel = styled.span`
  font-weight: 600;
`

const HiddenButtonRow = styled.div`
  display: none;
`

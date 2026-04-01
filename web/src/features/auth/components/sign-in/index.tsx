import { useNavigate } from 'react-router-dom'

import * as Styles from './styles.ts'

import Button from '@/ui/button.tsx'

export const SignIn = () => {
  const navigate = useNavigate()
  const onSignIn = () => () => navigate('/dashboard')

  return (
    <Styles.Stage>
      <Styles.Logo src="/img/photo/logo.svg" alt="work-address" />

      <Styles.Card>
        <Styles.Title>Welcome to Work Address</Styles.Title>

        <Styles.Desc>
          Join the future of freelancing with authentication powered by Ethereum
          and TON. Say goodbye to passwords and hello to Web3 experiences!
        </Styles.Desc>

        <Styles.Actions>
          <Styles.ProviderBtn type="button" onClick={() => onSignIn()}>
            <Styles.ProviderIcon
              src="/img/photo/ethereum-logo.svg"
              alt="Ethereum"
            />
            <Styles.ProviderText>Sign in with Ethereum</Styles.ProviderText>
          </Styles.ProviderBtn>

          <Styles.ProviderBtn type="button" onClick={() => onSignIn()}>
            <Styles.ProviderIcon src="/img/photo/ton-logo.svg" alt="Ton" />
            <Styles.ProviderText>Sign in with Ton</Styles.ProviderText>
          </Styles.ProviderBtn>
        </Styles.Actions>

        <Styles.Learn type="button">What is Web3 Wallet?</Styles.Learn>
      </Styles.Card>

      <Styles.Foot>
        <Styles.FootLine>
          <Styles.FootLabel>Ethereum wallets:</Styles.FootLabel>
          WalletConnect, Metamask, TrustWallet, Coinbase Wallet, Atomic Wallet,
          Exodus Wallet, Trezor Wallet, Edge Wallet, ZenGo Wallet, Crypto
          Wallet, BitPay Wallet, Opera Wallet
        </Styles.FootLine>
        <Styles.FootLine>
          <Styles.FootLabel>Ton wallets:</Styles.FootLabel>
          Telegram Wallet, Tonkeeper, MyTonWallet, OpenMask, TonHub, DeWallet,
          XTONWallet, TON Wallet
        </Styles.FootLine>
      </Styles.Foot>

      <Styles.HiddenButtonRow>
        <Button variant="secondary" onClick={() => onSignIn()}>
          Continue
        </Button>
      </Styles.HiddenButtonRow>
    </Styles.Stage>
  )
}

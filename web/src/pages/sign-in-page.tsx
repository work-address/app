import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import { AuthFormStyles as S, ProviderButton } from '@/features/auth'
import { Button, router, showErrorToast } from '@/features/shared'

export default function SignInPage() {
  const navigate = useNavigate()
  const { breakpoints } = useTheme()

  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const onSignIn = (type: 'ton' | 'eth') => {
    if (type === 'ton') {
      navigate(router.dashboard.schema)
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
    <>
      {isUpMd ? (
        <S.Logo src="/img/photo/logo.svg" alt="work-address" />
      ) : (
        <S.Logo src="/img/photo/logo.svg" alt="work-address" />
      )}

      <S.SignInCard>
        <S.Title>Welcome to Work Address</S.Title>

        <S.Desc>
          <S.Desc1Row>
            Join the future of freelancing with <S.MobileBreak />
            authentication
          </S.Desc1Row>

          <S.Desc2Row>
            powered by Ethereum and TON. <S.MobileBreak />
            Say goodbye to
          </S.Desc2Row>

          <S.Desc3Row>passwords and hello to Web3 experiences!</S.Desc3Row>
        </S.Desc>

        <S.Actions>
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
        </S.Actions>

        <S.Learn href={'#'} target={'_blank'}>
          What is Web3 Wallet?
        </S.Learn>
      </S.SignInCard>

      <S.Foot>
        <S.FootLine>
          <S.FootLabel>Ethereum wallets:&nbsp;</S.FootLabel>
          WalletConnect, Metamask, TrustWallet, Coinbase Wallet,
          <S.DesktopBreak />
          Atomic Wallet, Exodus Wallet, Exodus Wallet, Edge Wallet, Trezor
          Wallet
        </S.FootLine>

        <S.FootLine>
          <S.FootLabel>TON wallets:&nbsp;</S.FootLabel>
          Telegram Wallet, Tonkeeper, MyTonWallet, OpenMask,
          <S.DesktopBreak />
          TonHub, DeWallet, XTONWallet, TON Wallet
        </S.FootLine>
      </S.Foot>

      <S.HiddenButtonRow>
        <Button themeVariant="secondary" onClick={() => onSignIn('eth')}>
          Continue
        </Button>
      </S.HiddenButtonRow>
    </>
  )
}

import { Fragment } from 'react'

import { AuthFormStyles as S } from '@/features/auth'

import type { SupportedWallet } from '../supported-wallets'

type Props = {
  wallets: SupportedWallet[]
  breakAfter?: number
}

export const WalletList = ({ wallets, breakAfter = 4 }: Props) => (
  <>
    {wallets.map((wallet, index) => (
      <Fragment key={wallet.name}>
        {index > 0 &&
          (index === breakAfter ? <S.DesktopBreak /> : <>, </>)}
        <S.FootWalletLink
          href={wallet.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {wallet.name}
        </S.FootWalletLink>
      </Fragment>
    ))}
  </>
)

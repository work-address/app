import { Fragment } from 'react'
import styled from 'styled-components'

import type { SupportedWallet } from '../model'

import { AuthStyles as S } from '@/features/auth'

type Props = {
  wallets: SupportedWallet[]
  breakAfter?: number
}

export const AuthWalletList = ({ wallets, breakAfter = 4 }: Props) => (
  <>
    {wallets.map((wallet, index) => (
      <Fragment key={wallet.name}>
        {index > 0 && (index === breakAfter ? <DesktopBreak /> : <>, </>)}
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

export const DesktopBreak = styled.br`
  display: none;

  ${({ theme }) => theme.breakpoints.up('md')} {
    display: block;
  }
`

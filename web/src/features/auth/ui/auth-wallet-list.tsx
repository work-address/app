import { Fragment } from 'react'
import styled from 'styled-components'

import * as S from './auth-styles'

import type { SupportedWallet } from '../model'

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

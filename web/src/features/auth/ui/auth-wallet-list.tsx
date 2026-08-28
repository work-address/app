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
        {index > 0 &&
          (index === breakAfter ? (
            // The desktop line break hides on mobile, where the list keeps
            // flowing — so mobile still needs the comma between the names.
            // The comma goes after the break: a space right before a <br>
            // is stripped at layout even when the break is display: none.
            <>
              <DesktopBreak />
              <MobileComma>, </MobileComma>
            </>
          ) : (
            <>, </>
          ))}
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

const MobileComma = styled.span`
  /* The global reset makes spans inline-block, which trims the trailing
     space out of the separator — restore normal inline text flow. */
  display: inline;

  ${({ theme }) => theme.breakpoints.up('md')} {
    display: none;
  }
`

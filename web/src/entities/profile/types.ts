export type LoginMode = 'ton' | 'eth' | 'solana'

export type EthNonceParams = { address: string; mode: 'eth' }
export type TonNonceParams = { mode: 'ton' }
export type SolanaNonceParams = { address: string; mode: 'solana' }

export type GetNonceParams = EthNonceParams | TonNonceParams | SolanaNonceParams

export type AuthorizationHeaders = {
  authorization: string
  refreshToken: string
}

export type LoginMode = 'ton' | 'eth' | 'solana'

export type EthNonceParams = { address: string; mode: 'eth' }
export type TonNonceParams = { mode: 'ton' }

export type GetNonceParams = EthNonceParams | TonNonceParams

export type AuthorizationHeaders = {
  authorization: string
  refreshToken: string
}

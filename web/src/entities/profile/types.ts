import type { TonProofItemReplySuccess } from '@/shared'
import type { PublicKey } from '@solana/web3.js'
import type { BrowserProvider } from 'ethers'
import type { JsonRpcSigner } from 'ethers'

export type LoginMode = 'ton' | 'eth' | 'solana'

export type EthNonceParams = { address: string; mode: 'eth' }
export type TonNonceParams = { mode: 'ton' }
export type SolanaNonceParams = { address: string; mode: 'solana' }

export type GetNonceParams = EthNonceParams | TonNonceParams | SolanaNonceParams

export type AuthorizationHeaders = {
  authorization: string
  refreshToken: string
}

export type SolanaWalletState = {
  publicKey: PublicKey | null
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined
  disconnect: () => Promise<void>
  openModal: (visible: boolean) => void
  connected: boolean
}

export type SolanaModalResult = {
  address: string
}

export type EthModalResult = {
  signer: JsonRpcSigner
  address: string
  ethersProvider: BrowserProvider
}

export type TonAuthSuccessPayload = {
  address: string
  network: string
  public_key: string
  proof: TonProofItemReplySuccess['proof'] & {
    state_init: string
  }
}

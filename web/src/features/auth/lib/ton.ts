import { TonConnectUI } from '@tonconnect/ui'

export const tonUI = new TonConnectUI({
  manifestUrl: import.meta.env.VITE_TON_MANIFEST_URL,
})

export type {
  TonProofItemReplySuccess,
  TonProofItemReply,
} from '@tonconnect/ui'

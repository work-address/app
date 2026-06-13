import { TonConnectUI } from '@tonconnect/ui'

const manifestUrl =
  import.meta.env.VITE_TON_DEV_MANIFEST_URL ||
  `${window.location.origin}/tonconnect-manifest.json`

export const tonConnectProvider = new TonConnectUI({
  manifestUrl,
})

export type {
  TonProofItemReplySuccess,
  TonProofItemReply,
} from '@tonconnect/ui'

export { toUserFriendlyAddress as toUserFriendlyTonAddress } from '@tonconnect/ui'

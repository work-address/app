import { TonConnectUI } from '@tonconnect/ui'

export const tonConnectProvider = new TonConnectUI({
  manifestUrl: import.meta.env.DEV
    ? import.meta.env.VITE_TON_DEV_MANIFEST_URL
    : `${window.location.origin}/tonconnect-manifest.json`,
})

export type {
  TonProofItemReplySuccess,
  TonProofItemReply,
} from '@tonconnect/ui'

export { toUserFriendlyAddress as toUserFriendlyTonAddress } from '@tonconnect/ui'

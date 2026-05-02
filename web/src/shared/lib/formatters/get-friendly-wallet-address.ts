import { toUserFriendlyTonAddress } from '../wallet-provders'

// TODO: remove after backend returns chain in status
export const getFriendlyWalletAddress = (
  address: string | null | undefined,
): string | null => {
  if (!address) {
    return null
  }

  if (address.includes(':')) {
    return toUserFriendlyTonAddress(address)
  }

  if (address.includes('x')) {
    return address.toLowerCase()
  }

  return address
}

export const decodeFriendWalletAddress = (
  friendWalletAddress: string,
): string => {
  if (!friendWalletAddress) {
    return ''
  }

  if (friendWalletAddress.startsWith('0x')) {
    return friendWalletAddress
  } else {
    const addr = Address.parse(friendWalletAddress)
    return addr.toRawString() ?? friendWalletAddress
  }
}

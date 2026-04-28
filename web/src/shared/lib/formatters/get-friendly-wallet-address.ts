import { Address } from '@ton/core'

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
    return address
  }

  return address
}

export const decodeFriendWalletAddress = (
  friendWalletAddress: string,
): string => {
  if (!friendWalletAddress) {
    return ''
  }

  // 1. Проверка на TON (Friendly Base64)
  if (
    !friendWalletAddress.includes(':') &&
    !friendWalletAddress.includes('x')
  ) {
    const addr = Address.parse(friendWalletAddress)
    return addr.toRawString() // Вернет формат "0:abcd..."
  }

  // 2. Проверка на EVM (Ethereum/BSC и т.д.)
  if (friendWalletAddress.startsWith('0x')) {
    return friendWalletAddress // В EVM Raw — это и есть 0x-адрес
  }

  // 3. Raw TON (0:...)
  if (friendWalletAddress.includes(':')) {
    return friendWalletAddress
  }

  return friendWalletAddress
}

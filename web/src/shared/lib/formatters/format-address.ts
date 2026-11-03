/** An email is read whole; a wallet address is too long for most places. */
export const formatAddress = (address: string): string =>
  address.includes('@')
    ? address
    : `${address.slice(0, 5)}...${address.slice(-4)}`

export type SupportedWallet = {
  name: string
  url: string
}

export const ETHEREUM_WALLETS: SupportedWallet[] = [
  { name: 'WalletConnect', url: 'https://walletconnect.com/' },
  { name: 'MetaMask', url: 'https://metamask.io/' },
  { name: 'Trust Wallet', url: 'https://trustwallet.com/' },
  { name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet' },
  { name: 'Atomic Wallet', url: 'https://atomicwallet.io/' },
  { name: 'Exodus', url: 'https://www.exodus.com/' },
  { name: 'Trezor', url: 'https://trezor.io/' },
]

export const TON_WALLETS: SupportedWallet[] = [
  { name: 'Telegram Wallet', url: 'https://t.me/wallet' },
  { name: 'Tonkeeper', url: 'https://tonkeeper.com/' },
  { name: 'MyTonWallet', url: 'https://mytonwallet.io/' },
  { name: 'OpenMask', url: 'https://www.openmask.app/' },
  { name: 'TonHub', url: 'https://tonhub.com/' },
  { name: 'TON Wallet', url: 'https://wallet.ton.org/' },
]

export const SOLANA_WALLETS: SupportedWallet[] = [
  { name: 'Phantom', url: 'https://phantom.app/' },
  { name: 'Solflare', url: 'https://solflare.com/' },
  { name: 'Backpack', url: 'https://backpack.app/' },
  { name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet' },
  { name: 'Trust Wallet', url: 'https://trustwallet.com/' },
]

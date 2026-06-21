import { lazy, Suspense } from 'react'

const SolanaWalletShell = lazy(() =>
  import('./solana-wallet-shell').then((module) => ({
    default: module.SolanaWalletShell,
  })),
)

export const SolanaWalletMount = () => {
  return (
    <Suspense fallback={null}>
      <SolanaWalletShell />
    </Suspense>
  )
}

import { useUnit } from 'effector-react'
import { lazy, Suspense } from 'react'

import { $solanaModalMounted } from '@/entities/profile/solana.model'

const SolanaWalletShell = lazy(() =>
  import('./solana-wallet-shell').then((module) => ({
    default: module.SolanaWalletShell,
  })),
)

export const SolanaWalletMount = () => {
  const mountRequested = useUnit($solanaModalMounted)

  if (!mountRequested) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <SolanaWalletShell />
    </Suspense>
  )
}

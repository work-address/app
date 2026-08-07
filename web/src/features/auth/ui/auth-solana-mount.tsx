import { lazy, Suspense } from 'react'

const AuthSolanaWalletShell = lazy(() =>
  import('./auth-solana-wallet-shell').then((module) => ({
    default: module.AuthSolanaWalletShell,
  })),
)

export const AuthSolanaWalletMount = () => {
  return (
    <Suspense fallback={null}>
      <AuthSolanaWalletShell />
    </Suspense>
  )
}

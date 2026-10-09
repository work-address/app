import { useUnit } from 'effector-react'
import { useEffect, useState, type ComponentType } from 'react'

import {
  $solanaWalletMounted,
  solanaWalletLoadFailed,
} from '@/entities/profile'

export const AuthSolanaWalletMount = () => {
  const { mounted, loadFailed } = useUnit({
    mounted: $solanaWalletMounted,
    loadFailed: solanaWalletLoadFailed,
  })
  const [Shell, setShell] = useState<ComponentType | null>(null)

  useEffect(() => {
    if (!mounted) {
      return
    }
    let active = true
    import('./auth-solana-wallet-shell')
      .then((module) => {
        if (active) {
          setShell(() => module.AuthSolanaWalletShell)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          loadFailed(
            error instanceof Error ? error : new Error('Wallet load failed'),
          )
        }
      })
    return () => {
      active = false
    }
  }, [mounted, loadFailed])

  return mounted && Shell ? <Shell /> : null
}

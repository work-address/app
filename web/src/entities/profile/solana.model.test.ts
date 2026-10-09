import { allSettled, fork, scopeBind } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import {
  $solanaWalletMounted,
  openSolanaModalFx,
  SolanaWalletGate,
  solanaWalletLoadFailed,
} from './solana.model'

vi.mock('@/shared', () => ({ baseApi: {}, runApi: vi.fn() }))

const wallet = (openModal = vi.fn()) => ({
  publicKey: null,
  signMessage: undefined,
  disconnect: async () => {},
  connected: false,
  openModal,
})

describe('on-demand Solana wallet', () => {
  it('keeps the first sign-in click until the lazy bridge is ready', async () => {
    const scope = fork()
    const state = wallet()
    expect(scope.getState($solanaWalletMounted)).toBe(false)
    const opening = allSettled(openSolanaModalFx, { scope })
    expect(scope.getState($solanaWalletMounted)).toBe(true)
    scopeBind(SolanaWalletGate.open, { scope })(state)
    await opening
    expect(state.openModal).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('releases pending state and allows another attempt after a chunk failure', async () => {
    const scope = fork()
    const opening = allSettled(openSolanaModalFx, { scope })
    scopeBind(solanaWalletLoadFailed, { scope })(new Error('Offline'))
    expect(await opening).toMatchObject({ status: 'fail' })
    expect(scope.getState(openSolanaModalFx.pending)).toBe(false)
    expect(scope.getState($solanaWalletMounted)).toBe(false)

    const state = wallet()
    const retry = allSettled(openSolanaModalFx, { scope })
    scopeBind(SolanaWalletGate.open, { scope })(state)
    expect(await retry).toMatchObject({ status: 'done' })
    expect(state.openModal).toHaveBeenCalledExactlyOnceWith(true)
  })
})

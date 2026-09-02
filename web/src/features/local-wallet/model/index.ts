import { createEffect, createStore } from 'effector'

import type { HDNodeWallet, Wallet } from 'ethers'

import { loginEthFx } from '@/entities/profile'
import { baseApi, runApiData } from '@/shared'

/**
 * A wallet the app keeps for people who have no wallet app.
 *
 * The private key is generated (or imported) in the browser and stored in
 * localStorage as an encrypted JSON keystore - scrypt-derived key, the same
 * format wallet apps export - unlocked by a password the user chooses. The
 * password and the plain key never leave the device: signing in means
 * decrypting the key in memory, signing the server's nonce with it and
 * discarding it. Nothing is sent to the API beyond what a wallet app sends.
 *
 * The keystore lives only in this browser. Clearing site data, or moving to
 * another device, loses it unless the user exported the private key - which
 * is why the create flow says so and the profile offers the export.
 */

export const LOCAL_WALLET_STORAGE_KEY = 'wa.local-wallet'

export const LOCAL_WALLET_MIN_PASSWORD_LENGTH = 8

export type LocalWalletSummary = {
  address: string
  createdAt: string
}

type StoredLocalWallet = LocalWalletSummary & {
  /** The encrypted keystore JSON, as `Wallet.encrypt` produces it. */
  keystore: string
}

export type UnlockedLocalWallet = Wallet | HDNodeWallet

export type LocalWalletErrorCode = 'missing' | 'wrong-password' | 'invalid-key'

export class LocalWalletError extends Error {
  readonly code: LocalWalletErrorCode

  constructor(code: LocalWalletErrorCode) {
    super(`local wallet: ${code}`)
    this.name = 'LocalWalletError'
    this.code = code
  }
}

export const isLocalWalletError = (error: unknown): error is LocalWalletError =>
  error instanceof LocalWalletError

const readStored = (): StoredLocalWallet | null => {
  try {
    const raw = localStorage.getItem(LOCAL_WALLET_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<StoredLocalWallet>

    if (
      typeof parsed?.address !== 'string' ||
      typeof parsed?.keystore !== 'string'
    ) {
      return null
    }

    return {
      address: parsed.address,
      keystore: parsed.keystore,
      createdAt:
        typeof parsed.createdAt === 'string'
          ? parsed.createdAt
          : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

const toSummary = ({ address, createdAt }: StoredLocalWallet) => ({
  address,
  createdAt,
})

// ethers is a large dependency and this is the only place the sign-in page
// needs it, so it loads on demand like the wallet-app providers do.
const loadEthers = () => import('ethers')

/** `0x`-prefixed, whatever the user pasted; ethers validates the rest. */
const normalizePrivateKey = (value: string) => {
  const trimmed = value.trim()

  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
}

const persist = async (
  wallet: UnlockedLocalWallet,
  password: string,
): Promise<LocalWalletSummary> => {
  const stored: StoredLocalWallet = {
    address: wallet.address,
    keystore: await wallet.encrypt(password),
    createdAt: new Date().toISOString(),
  }

  localStorage.setItem(LOCAL_WALLET_STORAGE_KEY, JSON.stringify(stored))

  return toSummary(stored)
}

export const createLocalWalletFx = createEffect(
  async ({ password }: { password: string }) => {
    const { Wallet } = await loadEthers()
    const wallet = Wallet.createRandom()
    const summary = await persist(wallet, password)

    return { wallet: wallet as UnlockedLocalWallet, summary }
  },
)

export const importLocalWalletFx = createEffect(
  async ({
    privateKey,
    password,
  }: {
    privateKey: string
    password: string
  }) => {
    const { Wallet } = await loadEthers()
    let wallet: UnlockedLocalWallet

    try {
      wallet = new Wallet(normalizePrivateKey(privateKey))
    } catch {
      throw new LocalWalletError('invalid-key')
    }

    const summary = await persist(wallet, password)

    return { wallet, summary }
  },
)

/** Decrypts the stored key into memory. The caller must not persist it. */
export const unlockLocalWalletFx = createEffect(
  async ({ password }: { password: string }): Promise<UnlockedLocalWallet> => {
    const stored = readStored()

    if (!stored) {
      throw new LocalWalletError('missing')
    }

    const { Wallet } = await loadEthers()

    try {
      return await Wallet.fromEncryptedJson(stored.keystore, password)
    } catch {
      throw new LocalWalletError('wrong-password')
    }
  },
)

/** The plain private key, for the user to back up. Costs the password. */
export const exportLocalWalletFx = createEffect(
  async (params: { password: string }) =>
    (await unlockLocalWalletFx(params)).privateKey,
)

export const removeLocalWalletFx = createEffect(() => {
  localStorage.removeItem(LOCAL_WALLET_STORAGE_KEY)
})

/**
 * Signs the server's nonce with the unlocked key and finishes the Ethereum
 * login. The nonce is fetched directly rather than through the profile
 * entity's `getNonceFx`, whose completion is wired to the wallet-app signer.
 */
export const signInWithLocalWalletFx = createEffect(
  async (wallet: UnlockedLocalWallet) => {
    const address = wallet.address
    const nonce = await runApiData(() =>
      baseApi.authControllerNonce({ body: { address } }),
    )
    const signature = await wallet.signMessage(nonce as string)

    await loginEthFx({ signature, address })
  },
)

export const $localWallet = createStore<LocalWalletSummary | null>(
  (() => {
    const stored = readStored()

    return stored ? toSummary(stored) : null
  })(),
)
  .on(
    [createLocalWalletFx.doneData, importLocalWalletFx.doneData],
    (_, { summary }) => summary,
  )
  .on(removeLocalWalletFx.done, () => null)

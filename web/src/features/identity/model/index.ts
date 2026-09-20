import { createEffect, createEvent, createStore, sample } from 'effector'

import {
  IDENTITY_REGISTRY_ABI,
  IdentityWalletError,
  identityChainTarget,
  identityWalletFailure,
} from './identity-chain'
import { identityDisclosure, identityPreview } from './identity-slots'
import {
  identityActionState,
  identityApiOutcome,
  identityViewState,
} from './identity-state'

import type { IdentityChainTarget, IdentityConfig } from './identity-chain'
import type {
  IdentityActionOutcome,
  IdentityActionState,
  IdentityView,
} from './identity-state'
import type { UnlockedLocalWallet } from '@/features/local-wallet'
import type { ProfileExport } from '@/shared/vendor/identity'

import { $user } from '@/entities/profile'
import { unlockLocalWalletFx } from '@/features/local-wallet'
import { baseApi, isSameWalletAddress, runApiData } from '@/shared'
import {
  SCHEMA_ID_V1,
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  evmSubject,
  serializeDocument,
} from '@/shared/vendor/identity'

/** IdentityRegistry keys its records by a 20-byte EVM address and nothing else. */
const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/

// ethers is a large dependency and only this feature's transactions need it
// here, so it loads on demand exactly as the browser wallet's signing does.
const loadEthers = () => import('ethers')

const registryFor = async (
  target: IdentityChainTarget,
  wallet?: UnlockedLocalWallet,
) => {
  const { Contract, JsonRpcProvider, Network } = await loadEthers()
  const network = Network.from(target.chainId)
  const provider = new JsonRpcProvider(target.rpcUrl, network, {
    staticNetwork: network,
    // A read made right after the holder's own transaction has to see the new
    // block, so nothing here is served from a response cache.
    cacheTimeout: -1,
  })

  const chainId = Number((await provider.getNetwork()).chainId)

  if (chainId !== target.chainId) {
    provider.destroy()

    throw new IdentityWalletError(
      'wrongChain',
      `The endpoint answers as chain ${chainId}, not ${target.chainId}`,
    )
  }

  return {
    provider,
    contract: new Contract(
      target.registryAddress,
      [...IDENTITY_REGISTRY_ABI],
      wallet ? wallet.connect(provider) : provider,
    ),
  }
}

export const loadIdentityConfigFx = createEffect(() =>
  runApiData(() => baseApi.identityControllerConfig()),
)

export const readIdentityFx = createEffect((address: string) =>
  runApiData(() =>
    baseApi.userControllerReadIdentity({
      path: { address: address as never },
    }),
  ),
)

export const loadIdentityExportFx = createEffect(
  () =>
    runApiData(() =>
      baseApi.userControllerIdentityExport(),
    ) as Promise<ProfileExport>,
)

export const removeIdentityFx = createEffect(() =>
  runApiData(() => baseApi.userControllerRemoveIdentity()),
)

type PublishParams = { password: string }

/**
 * The whole publish, in the order the documents demand: unlock the key in
 * this browser, build the salted tree here, send the commitment from the
 * holder's own wallet, and only then hand the presentation and its export to
 * the API. Nothing before the last step leaves the device, and the API is
 * never asked to host a version the registry does not already hold.
 */
export const publishIdentityFx = createEffect(
  async ({ password }: PublishParams): Promise<IdentityView> => {
    const config = await runApiData(() => baseApi.identityControllerConfig())
    const target = identityChainTarget(config)

    if (!target) {
      throw new IdentityWalletError('noEndpoint')
    }

    const user = $user.getState()
    const address = user?.address ?? ''

    if (!EVM_ADDRESS.test(address)) {
      throw new IdentityWalletError('failed', 'This account is not an EVM one')
    }

    const wallet = await unlockLocalWalletFx({ password })

    if (!isSameWalletAddress(wallet.address, address)) {
      throw new IdentityWalletError(
        'locked',
        'The wallet in this browser is another account',
      )
    }

    const preview = identityPreview(user)
    const tree = buildProfileTree({
      subject: evmSubject(address, target.chainId),
      fields: preview.fields,
    })
    const { provider, contract } = await registryFor(target, wallet)

    try {
      const current = Number(await contract.versionCount(address))
      const presentation = createAnchoredPresentation(tree, {
        disclose: identityDisclosure(preview),
        anchor: {
          chainId: target.chainId,
          registry: target.registryAddress,
          version: current + 1,
        },
      })

      await (
        await contract.publish(presentation.commitment, SCHEMA_ID_V1, current)
      ).wait()

      return await runApiData(() =>
        baseApi.userControllerPublishIdentity({
          body: {
            presentation: JSON.parse(serializeDocument(presentation)) as Record<
              string,
              unknown
            >,
            export: JSON.parse(
              serializeDocument(createProfileExport(tree)),
            ) as Record<string, unknown>,
          },
        }),
      )
    } finally {
      provider.destroy()
    }
  },
)

/**
 * The holder's own `deactivate`. It is the only withdrawal there is: this
 * service can take its hosted copy down, but only the registry's holder can
 * retire the record on chain.
 */
export const withdrawIdentityFx = createEffect(
  async ({ password }: PublishParams): Promise<void> => {
    const config = await runApiData(() => baseApi.identityControllerConfig())
    const target = identityChainTarget(config)

    if (!target) {
      throw new IdentityWalletError('noEndpoint')
    }

    const address = $user.getState()?.address ?? ''
    const wallet = await unlockLocalWalletFx({ password })

    if (!isSameWalletAddress(wallet.address, address)) {
      throw new IdentityWalletError(
        'locked',
        'The wallet in this browser is another account',
      )
    }

    const { provider, contract } = await registryFor(target, wallet)

    try {
      const current = Number(await contract.versionCount(address))

      await (await contract.deactivate(current)).wait()
    } finally {
      provider.destroy()
    }
  },
)

export const identityCardMounted = createEvent()
export const identityActionDismissed = createEvent()

/**
 * The chip on a public profile asks about the profile being read, which is
 * not the account reading it: it keeps its own view rather than sharing the
 * holder's, so opening someone else's page never shows your own anchor.
 */
export const identityChipRequested = createEvent<string>()

export const readChipIdentityFx = createEffect((address: string) =>
  runApiData(() =>
    baseApi.userControllerReadIdentity({
      path: { address: address as never },
    }),
  ),
)

export const $identityConfig = createStore<IdentityConfig | null>(null).on(
  loadIdentityConfigFx.doneData,
  (_, config) => config,
)

export const $identityView = createStore<IdentityView | null>(null)
  .on(readIdentityFx.doneData, (_, view) => view)
  .on(publishIdentityFx.doneData, (_, view) => view)
  .on([readIdentityFx.fail, removeIdentityFx.done], () => null)

export const $identityExport = createStore<ProfileExport | null>(null)
  .on(loadIdentityExportFx.doneData, (_, document) => document)
  .reset(removeIdentityFx.done, publishIdentityFx.done)

const outcome = createEvent<IdentityActionOutcome>()

/**
 * The last thing that happened, as exactly one state - never two, and never
 * the state of the action before this one.
 */
export const $identityAction = createStore<IdentityActionState | null>(null)
  .reset(identityActionDismissed, identityCardMounted)
  .on(outcome, (_, next) => identityActionState(next))

sample({
  clock: publishIdentityFx.doneData,
  fn: (): IdentityActionOutcome => ({ kind: 'published' }),
  target: outcome,
})

sample({
  clock: withdrawIdentityFx.done,
  fn: (): IdentityActionOutcome => ({ kind: 'withdrawn' }),
  target: outcome,
})

sample({
  clock: removeIdentityFx.done,
  fn: (): IdentityActionOutcome => ({ kind: 'removed' }),
  target: outcome,
})

sample({
  clock: [publishIdentityFx.failData, withdrawIdentityFx.failData],
  fn: (error): IdentityActionOutcome =>
    error instanceof IdentityWalletError ||
    (error as { response?: unknown })?.response === undefined
      ? { kind: 'wallet', code: identityWalletFailure(error) }
      : identityApiOutcome(error),
  target: outcome,
})

sample({
  clock: removeIdentityFx.failData,
  fn: identityApiOutcome,
  target: outcome,
})

/** The card and the chip read the same state from the same three inputs. */
export const $identityViewState = sample({
  source: {
    config: $identityConfig,
    view: $identityView,
    user: $user,
  },
  fn: ({ config, view, user }) =>
    identityViewState({
      enabled: Boolean(config?.enabled),
      anchorable: EVM_ADDRESS.test(user?.address ?? ''),
      view,
    }),
})

export const $identityPreview = $user.map((user) => identityPreview(user))

export const $chipIdentity = createStore<IdentityView | null>(null)
  .on(readChipIdentityFx.doneData, (_, view) => view)
  .on([readChipIdentityFx.fail, identityChipRequested], () => null)

/**
 * A profile with nothing anchored, or an instance that anchors nowhere, ends
 * up in a state `isIdentityChipState` filters out, so the chip disappears
 * rather than announcing an absence.
 */
export const $chipState = sample({
  source: { config: $identityConfig, view: $chipIdentity },
  fn: ({ config, view }) =>
    identityViewState({
      enabled: Boolean(config?.enabled),
      anchorable: true,
      view,
    }),
})

sample({
  clock: identityChipRequested,
  target: [loadIdentityConfigFx, readChipIdentityFx],
})

const $holderAddress = $user.map((user) => user?.address ?? null)

sample({
  clock: identityCardMounted,
  target: loadIdentityConfigFx,
})

/**
 * The card reads the chain when it mounts, and again after a withdrawal: a
 * `deactivate` the holder's wallet mined is only visible here once the
 * registry has been asked again.
 */
sample({
  clock: [identityCardMounted, withdrawIdentityFx.done],
  source: $holderAddress,
  filter: (address): address is string => Boolean(address),
  target: readIdentityFx,
})

export { IDENTITY_COPY_KEYS, IDENTITY_FIELD_LABEL_KEY } from './identity-copy'
export {
  IDENTITY_REGISTRY_ABI,
  IdentityWalletError,
  identityChainTarget,
  identityRpcUrl,
  identityWalletFailure,
  type IdentityChainTarget,
  type IdentityConfig,
} from './identity-chain'
export {
  identityDisclosure,
  identityPreview,
  isIdentityPublishable,
  type IdentityPreview,
  type IdentitySlotPreview,
  type IdentitySlotState,
} from './identity-slots'
export {
  IDENTITY_ACTION_MESSAGE_KEY,
  IDENTITY_ACTION_TONE,
  IDENTITY_CHIP_STATES,
  IDENTITY_VIEW_MESSAGE_KEY,
  identityActionState,
  identityApiOutcome,
  identityViewState,
  isIdentityChipState,
  type IdentityActionOutcome,
  type IdentityActionState,
  type IdentityChainResult,
  type IdentityStatus,
  type IdentityUnavailable,
  type IdentityView,
  type IdentityViewState,
  type IdentityWalletFailure,
} from './identity-state'

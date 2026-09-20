import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { NotFoundError } from 'routing-controllers'
import * as web3 from 'web3'

import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
import IdentityChainStateException from '@/exception/identity-chain-state-exception'
import IdentityPresentationException from '@/exception/identity-presentation-exception'
import IdentityUnavailableException from '@/exception/identity-unavailable-exception'
import { IConfigParameters } from '@/model/config'
import { IdentityPublishDto } from '@/model/dto/identity'
import {
  EIdentityChainResult,
  EIdentityRefusal,
  EIdentitySaltCustody,
  EIdentityUnavailable,
  IHostedIdentity,
  IIdentityChain,
  IIdentityChainCheck,
  IIdentityChainEvent,
  IIdentityChainRead,
  IIdentityConfig,
  IIdentityPresentationRef,
  IIdentityPublication,
  IIdentityRemoval,
  IIdentityStatus,
  IIdentityView,
} from '@/model/identity'
import { EWalletChain } from '@/model/user'
import { UserRepository } from '@/repository/user-repository'
import { fromPromise } from '@/service/effect-bridge'
import { IdentityChainFactory } from '@/service/identity-chain-factory'
import { IdentityReadCache } from '@/service/identity-read-cache'
import { UserManager } from '@/service/user-manager'
import { WalletAddress } from '@/service/wallet-address'
import {
  ProfileError,
  SCHEMA_ID_V1,
  parseSubject,
  restoreProfileTree,
  serializeDocument,
  verifyPresentationDocument,
} from '@/vendor/identity'
import type {
  PresentationCheck,
  PresentationFailure,
  ProfileExport,
  ProfilePresentation,
} from '@/vendor/identity'

const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/

type AnchoredCheck = Extract<PresentationCheck, { mode: 'anchored' }>

/** A chain answer, or why there is none. */
type ChainAnswer =
  | { check: IIdentityChainCheck; block: number; finalized: boolean }
  | { unavailable: EIdentityUnavailable }

/**
 * Portable identity for the User domain: where this instance anchors profile
 * commitments (IdentityRegistry, read from APP_IDENTITY_*), and the hosted
 * copy of a holder's current anchored presentation.
 *
 * The holder builds the tree and publishes the commitment with their own
 * wallet; this service never sends a transaction and never builds a tree. It
 * checks what it is given with @work-address/identity (src/vendor/identity)
 * and with the registry's own checkPresentation, stores only the current
 * presentation on the user, and derives the version history from the
 * registry's events whenever it is read.
 */
@injectable()
export class IdentityManager {
  /** Profile schema v1 is the only one this service understands. */
  public static readonly SCHEMA_IDS = [SCHEMA_ID_V1]

  /** The library's offline verdicts, as this API names them. */
  private static readonly REFUSALS: Record<
    PresentationFailure,
    EIdentityRefusal
  > = {
    MalformedPresentation: EIdentityRefusal.MALFORMED_PRESENTATION,
    UnsupportedFormat: EIdentityRefusal.UNSUPPORTED_FORMAT,
    UnsupportedSchema: EIdentityRefusal.UNSUPPORTED_SCHEMA,
    UnsupportedSubjectScheme: EIdentityRefusal.UNSUPPORTED_SUBJECT_SCHEME,
    InvalidProof: EIdentityRefusal.INVALID_PROOF,
    CommitmentMismatch: EIdentityRefusal.COMMITMENT_MISMATCH,
    SignatureInvalid: EIdentityRefusal.SIGNATURE_INVALID,
  }

  @inject('parameters')
  protected parameters: IConfigParameters
  @inject('UserRepository')
  protected userRepository: UserRepository
  @inject('UserManager')
  protected userManager: UserManager
  @inject('IdentityChainFactory')
  protected chainFactory: IdentityChainFactory
  @inject('IdentityReadCache')
  protected readCache: IdentityReadCache

  /**
   * Read on every call rather than cached, so the answer is always the
   * configuration the next chain read would use.
   */
  public getConfig(): IIdentityConfig {
    const enabled = this.isEnabled()
    const { chainId, registryAddress, manifestUrl } = this.parameters.identity

    return {
      enabled,
      chainId: enabled ? chainId : null,
      registryAddress: enabled
        ? web3.utils.toChecksumAddress(registryAddress)
        : null,
      manifestUrl: enabled && manifestUrl ? manifestUrl : null,
      schemaIds: [...IdentityManager.SCHEMA_IDS],
    }
  }

  /**
   * All three of chain, registry and RPC endpoint, or nothing: a registry
   * without a chain id could be read on the wrong network, and one without an
   * endpoint cannot be read at all.
   */
  public isEnabled(): boolean {
    const { chainId, registryAddress, rpcUrl } = this.parameters.identity

    return (
      chainId !== null && EVM_ADDRESS.test(registryAddress) && rpcUrl !== ''
    )
  }

  /**
   * PUT /user/identity. Stores `dto.presentation` as `user`'s hosted
   * presentation, replacing any other, only when every check passes:
   *
   * 1. the account is an EVM one - IdentityRegistry keys records by a 20-byte
   *    EVM address, so TON and Solana accounts cannot be anchored (422);
   * 2. anchoring is configured here (503);
   * 3. the document verifies offline: shape, schema, every proof against the
   *    root, and the commitment against the anchor (422);
   * 4. its subject is `user` (403) and its anchor is this instance's
   *    registry (422);
   * 5. under hosted custody, the export rebuilds exactly this subject and
   *    root (422);
   * 6. the registry says it is the subject's current version (409 otherwise:
   *    the hosted copy is the current profile, never an older one).
   */
  public publish(
    user: User,
    dto: IdentityPublishDto,
  ): Effect.Effect<IIdentityPublication, unknown> {
    return Effect.gen(this, function* () {
      yield* IdentityManager.attempt(() => this.assertAnchorable(user))

      if (!this.isEnabled()) {
        return yield* Effect.fail(IdentityManager.notConfigured())
      }

      const presentation = IdentityManager.plain(dto.presentation)
      const checked = yield* IdentityManager.attempt(() =>
        this.verify(presentation, user),
      )
      const custody = dto.custody ?? EIdentitySaltCustody.HOSTED
      const held = yield* IdentityManager.attempt(() =>
        IdentityManager.heldExport(checked, custody, dto.export),
      )
      const chain = this.chain()
      const answer = yield* fromPromise(() =>
        this.ask(chain, IdentityManager.refOf(checked)),
      )

      if ('unavailable' in answer) {
        return yield* Effect.fail(IdentityManager.unavailable(answer))
      }

      if (answer.check.result !== EIdentityChainResult.CURRENT) {
        return yield* Effect.fail(
          new IdentityChainStateException(
            answer.check,
            `The registry answers ${answer.check.result} for version ${checked.registryCheck.version} of ${checked.subject.did}: only the current version is hosted`,
          ),
        )
      }

      const hosted: IHostedIdentity = {
        presentation: JSON.parse(
          serializeDocument(presentation as ProfilePresentation),
        ) as ProfilePresentation,
        version: checked.registryCheck.version,
        export: held,
      }

      yield* this.userRepository.saveHostedIdentity(user, hosted)
      // Before the read below, not after: what this instance hosts has just
      // changed, so anything remembered about the old version is wrong now
      // rather than merely old.
      this.readCache.invalidate(hosted.presentation.subject)

      const view = yield* fromPromise(() =>
        this.viewOf(user, hosted, chain, answer),
      )

      return { ...view, custody }
    })
  }

  /**
   * GET /user/:address/identity. The hosted presentation with a fresh chain
   * answer and the registry's history for the subject. A hidden profile is
   * the same 404 as an unknown address, except to its holder; an account
   * with nothing hosted is a 404 of its own. A chain that cannot be read is
   * reported in `status.unavailable`, never as a verdict on the presentation.
   */
  public read(
    user: User,
    viewer: User | null,
  ): Effect.Effect<IIdentityView, unknown> {
    return Effect.gen(this, function* () {
      if (!this.userManager.isVisibleTo(user, viewer)) {
        return yield* Effect.fail(new NotFoundError('User does not exist'))
      }

      const hosted = yield* this.userRepository.findHostedIdentity(user)

      if (!hosted) {
        return yield* Effect.fail(
          new NotFoundError('This account has no hosted identity'),
        )
      }

      if (!this.servesAnchorOf(hosted.presentation)) {
        return IdentityManager.viewWithout(
          user,
          hosted,
          EIdentityUnavailable.NOT_CONFIGURED,
        )
      }

      const ref = IdentityManager.refOfHosted(hosted)
      // The holder's own read always asks the chain. The cache exists for the
      // anonymous reads a public profile page makes, and the one change this
      // instance cannot see coming is the holder's own `deactivate` - so the
      // person who sent it is the one person who must never be told an answer
      // from before it.
      const cached =
        viewer?.id === user.id
          ? null
          : this.readCache.get(hosted.presentation.subject, ref)

      if (cached) {
        return IdentityManager.viewFrom(user, hosted, cached)
      }

      const chain = this.chain()
      const answer = yield* fromPromise(() => this.ask(chain, ref))

      return yield* fromPromise(() => this.viewOf(user, hosted, chain, answer))
    })
  }

  /**
   * DELETE /user/identity. Removes the hosted copy, and the held export with
   * it - and nothing else. The registry keeps every version the holder ever
   * published, and copies others saved stay where they are (SC-A07); the
   * answer says so, so no client can present this as a withdrawal.
   */
  public remove(user: User): Effect.Effect<IIdentityRemoval, unknown> {
    return Effect.gen(this, function* () {
      const hosted = yield* this.userRepository.findHostedIdentity(user)

      yield* this.userRepository.removeHostedIdentity(user)

      if (hosted) {
        this.readCache.invalidate(hosted.presentation.subject)
      }

      return {
        removed: hosted !== undefined,
        exportRemoved: Boolean(hosted?.export),
        chainUnchanged: true,
        message:
          'Removed the hosted copy only. IdentityRegistry still holds every version you published, and copies others saved remain; to withdraw it on chain, send deactivate from your wallet.',
      }
    })
  }

  /** GET /user/identity/export: the export held under hosted custody. */
  public heldExportOf(user: User): Effect.Effect<ProfileExport, unknown> {
    return Effect.gen(this, function* () {
      const hosted = yield* this.userRepository.findHostedIdentity(user)

      if (!hosted?.export) {
        return yield* Effect.fail(
          new NotFoundError('No private export is held for this account'),
        )
      }

      return hosted.export
    })
  }

  /**
   * TON and Solana accounts are refused by name, before anything else: the
   * registry is structurally EVM-only, so no document could change the
   * answer. It refuses the hosted anchored copy only; a self-signed export
   * the holder makes on their own device is untouched by it.
   */
  private assertAnchorable(user: User): void {
    const chain = WalletAddress.chainOf(user.address)

    if (chain === EWalletChain.EVM) {
      return
    }

    const name = chain === EWalletChain.TON ? 'TON' : 'Solana'

    throw new IdentityPresentationException(
      EIdentityRefusal.UNSUPPORTED_SUBJECT_SCHEME,
      `IdentityRegistry records only did:pkh:eip155 (EVM) accounts: it keys every record by a 20-byte EVM address, so a ${name} account has nowhere on it to be anchored. This refuses only the hosted anchored copy; it takes nothing away from a self-signed export made on your own device.`,
    )
  }

  /** Steps 3 and 4: offline verification, the subject and the registry. */
  private verify(presentation: unknown, user: User): AnchoredCheck {
    const check = verifyPresentationDocument(presentation)

    if (!check.ok) {
      throw new IdentityPresentationException(
        IdentityManager.REFUSALS[check.reason],
        check.detail,
      )
    }

    if (check.mode !== 'anchored') {
      throw new IdentityPresentationException(
        EIdentityRefusal.NOT_ANCHORED,
        'Only an anchored presentation is hosted: a self-signed one proves who wrote it, not that it is current, and stays with its holder',
      )
    }

    if (!WalletAddress.isSame(check.subject.address, user.address)) {
      throw new AccessException(
        'A presentation can only be published by its own subject',
      )
    }

    if (!this.servesAnchor(check.registryCheck)) {
      throw new IdentityPresentationException(
        EIdentityRefusal.WRONG_REGISTRY,
        `The presentation is anchored to ${check.registryCheck.registry} on chain ${check.registryCheck.chainId}, which this instance does not read`,
      )
    }

    return check
  }

  /**
   * Step 5. Under hosted custody the export must be the very tree the
   * presentation came from; under holder custody no export is taken at all.
   */
  private static heldExport(
    check: AnchoredCheck,
    custody: EIdentitySaltCustody,
    raw: Record<string, unknown> | undefined,
  ): ProfileExport | null {
    if (custody === EIdentitySaltCustody.HOLDER) {
      if (raw !== undefined) {
        throw new IdentityPresentationException(
          EIdentityRefusal.EXPORT_NOT_EXPECTED,
          'Under holder custody the private export stays with its holder: send the presentation alone',
        )
      }

      return null
    }

    if (raw === undefined) {
      throw new IdentityPresentationException(
        EIdentityRefusal.EXPORT_REQUIRED,
        'Hosted custody keeps the private export with the presentation: send it, or ask for holder custody to keep it yourself',
      )
    }

    const document = IdentityManager.plain(raw)
    let tree: ReturnType<typeof restoreProfileTree>

    try {
      tree = restoreProfileTree(document)
    } catch (error) {
      if (error instanceof ProfileError) {
        throw new IdentityPresentationException(
          EIdentityRefusal.INVALID_EXPORT,
          error.message,
        )
      }

      throw error
    }

    if (tree.subject.did !== check.subject.did || tree.root !== check.root) {
      throw new IdentityPresentationException(
        EIdentityRefusal.EXPORT_MISMATCH,
        'The export rebuilds another subject or root than the presentation it was sent with',
      )
    }

    return JSON.parse(
      serializeDocument(document as ProfileExport),
    ) as ProfileExport
  }

  /**
   * The chain's answer at the latest block, and whether the node's
   * finalized block agrees. Any failure to read is an answer too - never a
   * thrown error a caller could mistake for a verdict on the presentation.
   */
  private async ask(
    chain: IIdentityChain,
    ref: IIdentityPresentationRef,
  ): Promise<ChainAnswer> {
    try {
      if ((await chain.chainId()) !== this.parameters.identity.chainId) {
        return { unavailable: EIdentityUnavailable.WRONG_CHAIN }
      }

      const block = await chain.blockNumber()
      const check = await chain.checkPresentation(ref, block)

      if (!check) {
        return { unavailable: EIdentityUnavailable.RPC_UNAVAILABLE }
      }

      const final = await chain
        .checkPresentation(ref, 'finalized')
        .catch(() => null)

      return {
        check,
        block,
        finalized:
          final !== null &&
          final.result === check.result &&
          final.subjectDeactivated === check.subjectDeactivated,
      }
    } catch {
      return { unavailable: EIdentityUnavailable.RPC_UNAVAILABLE }
    }
  }

  private async viewOf(
    user: User,
    hosted: IHostedIdentity,
    chain: IIdentityChain,
    answer: ChainAnswer,
  ): Promise<IIdentityView> {
    return IdentityManager.viewFrom(
      user,
      hosted,
      await this.chainRead(hosted, chain, answer),
    )
  }

  /**
   * The six RPC calls of one read, as one answer. A complete answer is put in
   * the cache; an unavailable chain and a history that could not be served
   * are not, because remembering either would keep the registry hidden for
   * the whole window after it came back.
   */
  private async chainRead(
    hosted: IHostedIdentity,
    chain: IIdentityChain,
    answer: ChainAnswer,
  ): Promise<IIdentityChainRead> {
    if ('unavailable' in answer) {
      return IdentityManager.unavailableRead(answer.unavailable)
    }

    const ref = IdentityManager.refOfHosted(hosted)
    const status: IIdentityStatus = {
      result: answer.check.result,
      subjectDeactivated: answer.check.subjectDeactivated,
      checkedAtBlock: answer.block,
      finalized: answer.finalized,
      unavailable: null,
    }
    let history: IIdentityChainEvent[] | null = null

    try {
      history = await chain.history(
        ref,
        this.parameters.identity.deployBlock,
        answer.block,
      )
    } catch {
      // A node that will not serve the log range still answered the check;
      // the history is reported missing rather than as empty.
      history = null
    }

    const read: IIdentityChainRead = { status, history }

    if (history !== null) {
      this.readCache.set(hosted.presentation.subject, ref, read)
    }

    return read
  }

  private static viewFrom(
    user: User,
    hosted: IHostedIdentity,
    read: IIdentityChainRead,
  ): IIdentityView {
    return {
      address: user.address,
      subject: hosted.presentation.subject,
      version: hosted.version,
      presentation: hosted.presentation,
      status: read.status,
      history: read.history,
    }
  }

  private static unavailableRead(
    unavailable: EIdentityUnavailable,
  ): IIdentityChainRead {
    return {
      status: {
        result: null,
        subjectDeactivated: null,
        checkedAtBlock: null,
        finalized: false,
        unavailable,
      },
      history: null,
    }
  }

  private static viewWithout(
    user: User,
    hosted: IHostedIdentity,
    unavailable: EIdentityUnavailable,
  ): IIdentityView {
    return IdentityManager.viewFrom(
      user,
      hosted,
      IdentityManager.unavailableRead(unavailable),
    )
  }

  private chain(): IIdentityChain {
    const { rpcUrl, chainId } = this.parameters.identity

    return this.chainFactory.create(rpcUrl, chainId as number)
  }

  private servesAnchor(anchor: { chainId: number; registry: string }): boolean {
    const { chainId, registryAddress } = this.parameters.identity

    return (
      this.isEnabled() &&
      anchor.chainId === chainId &&
      anchor.registry.toLowerCase() === registryAddress.toLowerCase()
    )
  }

  private servesAnchorOf(presentation: ProfilePresentation): boolean {
    return (
      presentation.anchor !== null && this.servesAnchor(presentation.anchor)
    )
  }

  private static refOf(check: AnchoredCheck): IIdentityPresentationRef {
    const { registry, subject, version, commitment, schemaId } =
      check.registryCheck

    return { registry, subject, version, commitment, schemaId }
  }

  private static refOfHosted(
    hosted: IHostedIdentity,
  ): IIdentityPresentationRef {
    const { presentation } = hosted
    const anchor = presentation.anchor

    if (!anchor || !presentation.commitment) {
      throw new TypeError('A hosted presentation is always anchored')
    }

    return {
      registry: anchor.registry,
      subject: parseSubject(presentation.subject).leafSubject,
      version: anchor.version,
      commitment: presentation.commitment,
      schemaId: presentation.schemaId,
    }
  }

  /** A check that throws, as a failure in the Effect's error channel. */
  private static attempt<A>(check: () => A): Effect.Effect<A, unknown> {
    return Effect.try({ try: check, catch: (error) => error })
  }

  /**
   * A JSON document as plain objects and arrays only, whatever the request
   * body parser and class-transformer made of it: the library refuses class
   * instances, rightly.
   */
  private static plain(value: unknown): unknown {
    // JSON, not structuredClone: this is the document as the wire carries
    // it, so an undefined member is dropped rather than kept as a key.
    // eslint-disable-next-line unicorn/prefer-structured-clone
    return JSON.parse(JSON.stringify(value))
  }

  private static notConfigured(): IdentityUnavailableException {
    return new IdentityUnavailableException(
      EIdentityUnavailable.NOT_CONFIGURED,
      'Identity anchoring is not configured on this instance',
    )
  }

  private static unavailable(answer: {
    unavailable: EIdentityUnavailable
  }): IdentityUnavailableException {
    return answer.unavailable === EIdentityUnavailable.WRONG_CHAIN
      ? new IdentityUnavailableException(
          answer.unavailable,
          'The RPC endpoint answers as another chain than the one configured',
        )
      : new IdentityUnavailableException(
          answer.unavailable,
          'The registry could not be read: nothing is known about this presentation yet',
        )
  }
}

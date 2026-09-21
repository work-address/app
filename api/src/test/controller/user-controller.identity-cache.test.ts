import { expect } from 'chai'
import { Wallet } from 'ethers'
import { suite, test, timeout } from '@testdeck/mocha'

import {
  userControllerPublishIdentity,
  userControllerReadIdentity,
  userControllerRemoveIdentity,
} from '@app/api-client'

import { User } from '@/entity/user'
import { IConfigParameters } from '@/model/config'
import {
  IIdentityChain,
  IIdentityChainEvent,
  IIdentityPresentationRef,
  IIdentityRegistryRef,
} from '@/model/identity'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'
import { IdentityChainFactory } from '@/service/identity-chain-factory'
import { IdentityReadCache } from '@/service/identity-read-cache'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { IdentityRegistryFake } from '@/test/fixture/identity-registry-fake'
import {
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  evmSubject,
  serializeDocument,
} from '@/vendor/identity'
import type { ProfileFields, ProfileTree } from '@/vendor/identity'

const CHAIN_ID = 31337
const REGISTRY = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'

const FIELDS: ProfileFields = {
  name: 'Ada Lovelace',
  title: 'Analyst',
  skills: ['Solidity', 'TypeScript'],
}

/**
 * The registry, with every call it is asked to make counted. One anonymous
 * read costs six: the chain id, the block number, the check at that block,
 * the finalized block behind `checkPresentation('finalized')`, that second
 * check, and the event scan.
 */
class CountingRegistry implements IIdentityChain {
  public calls = 0

  constructor(private readonly inner: IdentityRegistryFake) {}

  public get fake(): IdentityRegistryFake {
    return this.inner
  }

  public chainId(): Promise<number> {
    this.calls += 1

    return this.inner.chainId()
  }

  public blockNumber(): Promise<number> {
    this.calls += 1

    return this.inner.blockNumber()
  }

  public checkPresentation(
    ref: IIdentityPresentationRef,
    blockTag: number | 'finalized',
  ) {
    // The finalized read is two requests at the endpoint: the block, then the
    // call at it (IdentityRpcChain.hasFinalizedBlock).
    this.calls += blockTag === 'finalized' ? 2 : 1

    return this.inner.checkPresentation(ref, blockTag)
  }

  public history(
    ref: IIdentityRegistryRef,
    fromBlock: number,
    toBlock: number,
  ): Promise<IIdentityChainEvent[]> {
    this.calls += 1

    return this.inner.history(ref, fromBlock, toBlock)
  }
}

/**
 * IDENTITY-READ-CACHE: a public profile's identity read is answered from a
 * short-lived cache instead of six RPC calls, and never at the cost of
 * showing a holder a version this instance has already replaced.
 */
@suite()
export class UserControllerIdentityCacheTest extends BaseControllerTest {
  private registry: CountingRegistry
  private savedIdentity: IConfigParameters['identity']
  private savedCreate: IdentityChainFactory['create']

  private get userRepository(): UserRepository {
    return this.container.get('UserRepository')
  }

  private get chainFactory(): IdentityChainFactory {
    return this.container.get('IdentityChainFactory')
  }

  private get cache(): IdentityReadCache {
    return this.container.get('IdentityReadCache')
  }

  @timeout(10000)
  async before() {
    await super.before()

    this.savedIdentity = { ...this.parameters.identity }
    Object.assign(this.parameters.identity, {
      chainId: CHAIN_ID,
      registryAddress: REGISTRY,
      rpcUrl: 'http://registry.test:8545',
      manifestUrl: '',
      deployBlock: 0,
    })

    this.registry = new CountingRegistry(
      new IdentityRegistryFake(REGISTRY, CHAIN_ID),
    )
    this.savedCreate = this.chainFactory.create
    this.chainFactory.create = () => this.registry
    this.cache.ttlMs = IdentityReadCache.DEFAULT_TTL_MS
    this.cache.clear()
  }

  @timeout(10000)
  async after() {
    this.chainFactory.create = this.savedCreate
    this.cache.ttlMs = 0
    this.cache.clear()
    Object.assign(this.parameters.identity, this.savedIdentity)
    await super.after()
  }

  @test()
  async read_asksTheRegistrySixTimesOnceAndThenNotAtAll() {
    const holder = await this.holder()

    await this.publish(holder)

    // A publish ends with a complete, current answer, so it leaves the
    // subject warm: the profile page the holder is sent to costs nothing.
    const afterPublish = this.registry.calls

    await this.read(holder)

    expect(
      this.registry.calls - afterPublish,
      'the read straight after a publish',
    ).to.equal(0)

    this.cache.clear()

    const cold = this.registry.calls
    const first = await this.read(holder)
    const firstRead = this.registry.calls - cold

    expect(firstRead, 'one uncached read').to.equal(6)

    const second = await this.read(holder)
    const third = await this.read(holder)

    expect(
      this.registry.calls - cold,
      'two further reads cost nothing',
    ).to.equal(firstRead)
    expect(second).to.deep.equal(first)
    expect(third).to.deep.equal(first)
  }

  /** The window is short, and zero means every read goes to the chain. */
  @test()
  async read_goesBackToTheRegistryWhenTheWindowIsClosed() {
    const holder = await this.holder()

    await this.publish(holder)
    await this.read(holder)

    this.cache.ttlMs = 0

    const before = this.registry.calls

    await this.read(holder)

    expect(this.registry.calls - before).to.equal(6)
  }

  /**
   * The one thing a cache must never do here: answer a holder's new version
   * with the one it replaced. Publishing invalidates the subject, so the next
   * anonymous read shows version 2 at once rather than up to a window later.
   */
  @test()
  async publish_isVisibleImmediately() {
    const holder = await this.holder()

    await this.publish(holder)

    const first = await this.read(holder)

    expect(first.version).to.equal(1)

    const beforeSecond = this.registry.calls

    await this.publish(holder, { ...FIELDS, title: 'Mathematician' })

    const second = await this.read(holder)

    expect(second.version).to.equal(2)
    expect(second.status.result).to.equal('Current')
    expect(
      second.history?.map(({ kind, version }) => ({ kind, version })),
    ).to.deep.equal([
      { kind: 'PUBLISHED', version: 1 },
      { kind: 'PUBLISHED', version: 2 },
    ])
    expect(
      this.registry.calls,
      'the new version was read from the chain, not from the cache',
    ).to.be.greaterThan(beforeSecond)
  }

  /** Taking the hosted copy down clears what was remembered about it. */
  @test()
  async remove_isVisibleImmediately() {
    const holder = await this.holder()

    await this.publish(holder)
    await this.read(holder)

    await userControllerRemoveIdentity({
      client: this.apiClient(),
      headers: this.auth(holder),
      throwOnError: true,
    })

    expect(await this.readStatus(holder)).to.equal(404)
  }

  /**
   * The cache is for the readers of a public page. The holder's own read is
   * the one that must show a `deactivate` their wallet just sent, which this
   * instance has no other way of learning about.
   */
  @test()
  async read_asTheHolderAlwaysAsksTheChain() {
    const holder = await this.holder()

    await this.publish(holder)
    await this.read(holder)

    // Someone else's transaction: this instance has no way of hearing about
    // it, which is the whole cost of the window.
    this.registry.fake.deactivate(holder.address)

    const anonymous = await this.read(holder)

    expect(anonymous.status.result, 'the window has not closed yet').to.equal(
      'Current',
    )

    const own = await this.read(holder, holder)

    expect(own.status.result).to.equal('Deactivated')
    expect(own.status.subjectDeactivated).to.equal(true)
  }

  /** A chain that cannot be read is never remembered as an answer. */
  @test()
  async read_doesNotCacheAnUnreachableRegistry() {
    const holder = await this.holder()

    await this.publish(holder)
    // The publish left a current answer behind; this case is about what
    // happens when the next read has to reach the endpoint itself.
    this.cache.clear()

    this.registry.fake.down = true

    const unavailable = await this.read(holder)

    expect(unavailable.status.unavailable).to.equal('RpcUnavailable')

    this.registry.fake.down = false

    const recovered = await this.read(holder)

    expect(recovered.status.result).to.equal('Current')
  }

  private async holder(): Promise<User> {
    const user = await this.userFixture.createUser()

    user.address = Wallet.createRandom().address

    return runPromise(this.userRepository.saveSingle(user))
  }

  private async publish(holder: User, fields: ProfileFields = FIELDS) {
    const tree: ProfileTree = buildProfileTree({
      subject: evmSubject(holder.address, CHAIN_ID),
      fields,
    })
    // The holder's wallet publishes first; the API only ever hosts what the
    // registry already holds as the subject's current version.
    const version = this.registry.fake.versionCount(holder.address) + 1

    const presentation = createAnchoredPresentation(tree, {
      disclose: ['name', 'title', 'skills'],
      anchor: { chainId: CHAIN_ID, registry: REGISTRY, version },
    })

    if (!presentation.commitment) {
      throw new Error('An anchored presentation carries a commitment')
    }

    this.registry.fake.publish(holder.address, presentation.commitment)

    return userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(holder),
      body: {
        presentation: JSON.parse(serializeDocument(presentation)) as Record<
          string,
          unknown
        >,
        export: JSON.parse(
          serializeDocument(createProfileExport(tree)),
        ) as Record<string, unknown>,
      },
      throwOnError: true,
    })
  }

  private async read(subject: User, viewer?: User) {
    return (
      await userControllerReadIdentity({
        client: this.apiClient(),
        path: { address: subject.address as never },
        ...(viewer ? { headers: this.auth(viewer) } : {}),
        throwOnError: true,
      })
    ).data
  }

  private async readStatus(subject: User): Promise<number | undefined> {
    try {
      return (
        await userControllerReadIdentity({
          client: this.apiClient(),
          path: { address: subject.address as never },
          throwOnError: true,
        })
      ).status
    } catch (error: unknown) {
      const response = (error as { response?: { status?: number } }).response

      if (!response) {
        throw error
      }

      return response.status
    }
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }
}

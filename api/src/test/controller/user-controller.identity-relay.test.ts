import { expect } from 'chai'
import axios from 'axios'
import bs58 from 'bs58'
import { AbiCoder, keccak256, Wallet, getAddress } from 'ethers'
import { sign } from 'tweetnacl'
import { suite, test, timeout } from '@testdeck/mocha'

import {
  identityControllerConfig,
  userControllerRelayIdentity,
} from '@app/api-client'
import type { IdentityRelayDto } from '@app/api-client'

import { User } from '@/entity/user'
import { IConfigParameters } from '@/model/config'
import { UserRepository } from '@/repository/user-repository'
import { AdvisoryLock } from '@/service/advisory-lock'
import { runPromise } from '@/service/effect-bridge'
import { IdentityRelayer } from '@/service/identity-relayer'
import { IdentityRelayerChainFactory } from '@/service/identity-relayer-chain-factory'
import { RedisClient } from '@/service/redis-client'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { IdentityRelayerChainFake } from '@/test/fixture/identity-relayer-chain-fake'

const CHAIN_ID = 31337
const REGISTRY = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
/** A key made for this suite; it exists nowhere but in the fake chain. */
const RELAYER_KEY = Wallet.createRandom().privateKey
const COMMITMENT = keccak256('0x1234')

/**
 * Written out here rather than taken from IdentityRelayer, so the suite signs
 * what IdentityRegistry.ACTION_TYPEHASH says and not whatever the service
 * happens to verify.
 */
const ACTION_TYPES = {
  Action: [
    { name: 'operation', type: 'uint8' },
    { name: 'subject', type: 'address' },
    { name: 'payload', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
}

interface IHolder {
  user: User
  wallet: Wallet
}

interface IFailure {
  status: number | undefined
  retryAfter: string | undefined
  data: { errors?: Record<string, unknown>[] }
}

/**
 * WP-122 against the relayer's view of a chain in memory
 * (IdentityRelayerChainFake): what is sent, what is refused before any gas
 * is spent, the ration, and the relayer's nonce across replicas. The same
 * relay runs against the real IdentityRegistry on a Hardhat node in
 * user-controller.identity-relay.node.test.
 */
@suite()
export class UserControllerIdentityRelayTest extends BaseControllerTest {
  private chain: IdentityRelayerChainFake
  private reports: unknown[]
  private savedIdentity: IConfigParameters['identity']
  private savedRelayer: IConfigParameters['identityRelayer']
  private savedCreate: IdentityRelayerChainFactory['create']
  private savedReport: IdentityRelayer['report']

  private get userRepository(): UserRepository {
    return this.container.get('UserRepository')
  }

  private get relayer(): IdentityRelayer {
    return this.container.get('IdentityRelayer')
  }

  private get chainFactory(): IdentityRelayerChainFactory {
    return this.container.get('IdentityRelayerChainFactory')
  }

  @timeout(10000)
  async before() {
    await super.before()

    this.savedIdentity = { ...this.parameters.identity }
    this.savedRelayer = { ...this.parameters.identityRelayer }
    Object.assign(this.parameters.identity, {
      chainId: CHAIN_ID,
      registryAddress: REGISTRY,
      rpcUrl: 'http://registry.test:8545',
      manifestUrl: '',
      deployBlock: 0,
    })
    Object.assign(this.parameters.identityRelayer, {
      key: RELAYER_KEY,
      gasLimit: 250_000,
      maxFeeGwei: 100,
      publishesPerDay: 5,
    })

    this.chain = new IdentityRelayerChainFake(
      CHAIN_ID,
      new Wallet(RELAYER_KEY).address,
    )
    this.savedCreate = this.chainFactory.create
    this.chainFactory.create = () => this.chain
    this.reports = []
    // The relayer is the process's one instance; what an earlier case made
    // it report must not silence the same report here.
    ;(
      this.relayer as unknown as { reported: Map<string, string> }
    ).reported.clear()
    this.savedReport = this.relayer.report
    this.relayer.report = (error) => this.reports.push(error)
  }

  @timeout(10000)
  async after() {
    await this.relayer.settled()
    this.relayer.report = this.savedReport
    this.chainFactory.create = this.savedCreate
    Object.assign(this.parameters.identity, this.savedIdentity)
    Object.assign(this.parameters.identityRelayer, this.savedRelayer)
    await super.after()
  }

  @test()
  async config_reportsTheRelayOffWithoutAKey_andTheRouteRefusesWith503() {
    this.parameters.identityRelayer.key = ''

    const config = await identityControllerConfig({
      client: this.apiClient(),
      throwOnError: true,
    })

    expect(config.data.enabled).to.equal(true)
    expect(config.data.relayEnabled).to.equal(false)

    const holder = await this.holder()
    const failure = await this.relayFails(
      holder.user,
      await this.publication(holder),
    )

    expect(failure.status).to.equal(503)
    expect(failure.data.errors).to.deep.equal([{ reason: 'RelayDisabled' }])
    expect(this.chain.sent).to.have.length(0)
  }

  @test()
  async config_reportsTheRelayOffWhenAnchoringIsOff_evenWithAKey() {
    this.parameters.identity.rpcUrl = ''

    const config = await identityControllerConfig({
      client: this.apiClient(),
      throwOnError: true,
    })

    expect(config.data).to.include({ enabled: false, relayEnabled: false })
  }

  @test()
  async config_aKeyThatIsNotAKeyTurnsTheRelayOff() {
    for (const key of ['0x1234', `0x${'0'.repeat(64)}`, 'not a key']) {
      this.parameters.identityRelayer.key = key

      const config = await identityControllerConfig({
        client: this.apiClient(),
        throwOnError: true,
      })

      expect(config.data.relayEnabled, key).to.equal(false)
    }
  }

  /** The zero-ETH holder's publication, sent exactly as signed, gas paid by the relayer. */
  @test()
  async relay_sendsTheSignedPublicationAsSigned_andAnswers202() {
    const config = await identityControllerConfig({
      client: this.apiClient(),
      throwOnError: true,
    })

    expect(config.data.relayEnabled).to.equal(true)

    const holder = await this.holder()
    const body = await this.publication(holder)
    const relayed = await userControllerRelayIdentity({
      client: this.apiClient(),
      headers: this.auth(holder.user),
      body,
      throwOnError: true,
    })

    expect(relayed.status).to.equal(202)
    expect(this.chain.sent).to.have.length(1)

    const [tx] = this.chain.sent

    expect(relayed.data).to.deep.equal({
      operation: 'Publish',
      subject: holder.wallet.address,
      nonce: '0',
      relayer: new Wallet(RELAYER_KEY).address,
      transactionHash: tx.hash,
    })

    expect(tx.call).to.deep.equal({
      operation: 'Publish',
      subject: holder.wallet.address,
      commitment: COMMITMENT,
      schemaId: 1,
      expectedVersion: 0,
      deadline: body.deadline,
      signature: body.signature,
    })
    // The estimate and a quarter, under the cap; fees are the chain's own.
    expect(tx.gas).to.deep.include({
      nonce: 0,
      gasLimit: BigInt(150_000),
      maxFeePerGas: this.chain.quotedFees.maxFeePerGas,
      maxPriorityFeePerGas: this.chain.quotedFees.maxPriorityFeePerGas,
    })
    expect(this.chain.versionCount(holder.wallet.address)).to.equal(1)
    expect(this.reports).to.deep.equal([])
  }

  @test()
  async relay_sendsASignedWithdrawal() {
    const holder = await this.holder()

    this.chain.publishDirectly(holder.wallet.address)

    const relayed = await userControllerRelayIdentity({
      client: this.apiClient(),
      headers: this.auth(holder.user),
      body: await this.withdrawal(holder, 1),
      throwOnError: true,
    })

    expect(relayed.status).to.equal(202)
    expect(relayed.data.operation).to.equal('Deactivate')
    expect(this.chain.sent.map(({ call }) => call.operation)).to.deep.equal([
      'Deactivate',
    ])
    expect(this.chain.isActive(holder.wallet.address)).to.equal(false)
  }

  /** ID-07 acceptance 2: a signature for another subject never reaches the chain. */
  @test()
  async relay_refusesAnAuthorizationForAnotherSubject_with403() {
    const holder = await this.holder()
    const other = await this.holder()

    const failure = await this.relayFails(
      other.user,
      await this.publication(holder),
    )

    expect(failure.status).to.equal(403)
    expect(this.chain.sent).to.have.length(0)
  }

  /** Signed by some other key over the caller's own subject: a forgery. */
  @test()
  async relay_refusesASignatureMadeByAnotherKey_beforeAnyGas() {
    const holder = await this.holder()
    const mallory = new Wallet(Wallet.createRandom().privateKey)
    const body = await this.publication(holder, { signer: mallory })

    const failure = await this.relayFails(holder.user, body)

    expect(failure.status).to.equal(422)
    expect(failure.data.errors).to.deep.equal([
      { reason: 'InvalidAuthorization' },
    ])
    expect(this.chain.sent).to.have.length(0)
  }

  /** ID-07 acceptance 2: the payload the subject signed, and no other. */
  @test()
  async relay_refusesAnotherPayloadThanTheOneSigned_beforeAnyGas() {
    const holder = await this.holder()
    const body = await this.publication(holder)

    for (const tampered of [
      { ...body, commitment: keccak256('0x5678') },
      { ...body, schemaId: 2 },
      { ...body, expectedVersion: 1 },
      { ...body, deadline: body.deadline + 1 },
    ]) {
      const failure = await this.relayFails(holder.user, tampered)

      expect(failure.status).to.equal(422)
      expect(failure.data.errors).to.deep.equal([
        { reason: 'InvalidAuthorization' },
      ])
    }

    // A publication signature is not a withdrawal's either.
    const asWithdrawal = await this.relayFails(holder.user, {
      operation: 'Deactivate',
      subject: body.subject,
      expectedVersion: 0,
      deadline: body.deadline,
      signature: body.signature,
    })

    expect(asWithdrawal.status).to.equal(422)
    expect(this.chain.sent).to.have.length(0)
  }

  /** Once mined, the nonce has moved: the same body is refused before any gas. */
  @test()
  async relay_refusesAReplayedAuthorization_beforeAnyGas() {
    const holder = await this.holder()
    const body = await this.publication(holder)

    await this.relay(holder, body)

    const failure = await this.relayFails(holder.user, body)

    expect(failure.status).to.equal(422)
    expect(failure.data.errors).to.deep.equal([
      { reason: 'InvalidAuthorization' },
    ])
    expect(this.chain.sent).to.have.length(1)
  }

  /**
   * Sent twice before it is mined - a double click, a retry after a lost
   * answer - one authorization is one transaction: the second request is
   * answered with the first one's hash, and a different action signed at the
   * same nonce is refused rather than sent to revert.
   */
  @test()
  async relay_sendsOneAuthorizationOnce_whileItIsOnItsWay() {
    this.chain.automine = false

    const holder = await this.holder()
    const body = await this.publication(holder)
    const first = await this.relay(holder, body)
    const again = await this.relay(holder, body)

    expect(again.transactionHash).to.equal(first.transactionHash)
    expect(this.chain.sent).to.have.length(1)

    const rival = await this.relayFails(
      holder.user,
      await this.publication(holder, { commitment: keccak256('0xbeef') }),
    )

    expect(rival.status).to.equal(409)
    expect(rival.data.errors).to.deep.equal([
      { reason: 'AuthorizationInFlight' },
    ])
    expect(this.chain.sent).to.have.length(1)

    // Dropped by the node, the same authorization may be sent again.
    this.chain.drop(first.transactionHash)

    const resent = await this.relay(holder, body)

    expect(resent.transactionHash).to.not.equal(first.transactionHash)
    expect(
      this.chain.sent.map(({ hash, gas, call }) => ({
        hash,
        nonce: gas.nonce,
        signature: call.signature,
      })),
    ).to.deep.equal([
      { hash: resent.transactionHash, nonce: 0, signature: body.signature },
    ])
    this.chain.mine()
  }

  @test()
  async relay_refusesAnExpiredDeadline_beforeAnyGas() {
    const holder = await this.holder()
    const body = await this.publication(holder, {
      deadline: this.chain.now,
    })

    const failure = await this.relayFails(holder.user, body)

    expect(failure.status).to.equal(422)
    expect(failure.data.errors).to.deep.equal([
      { reason: 'AuthorizationExpired' },
    ])
    expect(this.chain.sent).to.have.length(0)
  }

  /** What the registry would revert is refused by name and never mined. */
  @test()
  async relay_refusesWhatTheRegistryWouldRevert_with409() {
    const holder = await this.holder()

    this.chain.publishDirectly(holder.wallet.address)

    // Signed against version 0 while the record is at 1.
    const stale = await this.relayFails(
      holder.user,
      await this.publication(holder),
    )

    expect(stale.status).to.equal(409)
    expect(stale.data.errors).to.deep.equal([
      { reason: 'ChainRefused', error: 'VersionConflict' },
    ])

    const other = await this.holder()
    const nothing = await this.relayFails(
      other.user,
      await this.withdrawal(other, 0),
    )

    expect(nothing.status).to.equal(409)
    expect(nothing.data.errors).to.deep.equal([
      { reason: 'ChainRefused', error: 'NotPublished' },
    ])
    expect(this.chain.sent).to.have.length(0)
  }

  @test()
  async relay_neverSendsOverTheGasCap_andReportsItOnce() {
    this.chain.gas = BigInt(300_000)

    const holder = await this.holder()

    for (let attempt = 0; attempt < 2; attempt++) {
      const failure = await this.relayFails(
        holder.user,
        await this.publication(holder),
      )

      expect(failure.status).to.equal(503)
      expect(failure.data.errors).to.deep.equal([{ reason: 'GasCap' }])
    }

    expect(this.chain.sent).to.have.length(0)
    expect(this.reports).to.have.length(1)
    expect(String(this.reports[0])).to.contain('APP_IDENTITY_RELAYER_GAS_LIMIT')
  }

  @test()
  async relay_neverPaysOverTheFeeCap_andCapsWhatItOffers() {
    const holder = await this.holder()

    this.parameters.identityRelayer.maxFeeGwei = 0.5

    const failure = await this.relayFails(
      holder.user,
      await this.publication(holder),
    )

    expect(failure.status).to.equal(503)
    expect(failure.data.errors).to.deep.equal([{ reason: 'FeeCap' }])
    expect(this.chain.sent).to.have.length(0)
    expect(this.reports).to.have.length(1)

    // Under the cap, the offer is cut to it rather than the chain's quote.
    this.parameters.identityRelayer.maxFeeGwei = 2
    await this.relay(holder, await this.publication(holder))

    expect(this.chain.sent[0].gas.maxFeePerGas).to.equal(BigInt(2_000_000_000))
  }

  @test()
  async relay_refusesWhileTheRelayerCannotPay_andReportsIt() {
    this.chain.relayerBalance = BigInt(1)

    const holder = await this.holder()
    const failure = await this.relayFails(
      holder.user,
      await this.publication(holder),
    )

    expect(failure.status).to.equal(503)
    expect(failure.data.errors).to.deep.equal([
      { reason: 'RelayerUnavailable' },
    ])
    expect(this.chain.sent).to.have.length(0)
    expect(String(this.reports[0])).to.contain('fund it')
  }

  @test()
  async relay_anUnreachableNodeIs503_andReported() {
    const holder = await this.holder()
    const body = await this.publication(holder)

    this.chain.down = true

    const failure = await this.relayFails(holder.user, body)

    expect(failure.status).to.equal(503)
    expect(failure.data.errors).to.deep.equal([
      { reason: 'RelayerUnavailable' },
    ])
    expect(this.reports).to.have.length(1)
  }

  /** A relayed transaction that reverts once mined is the relayer's failure: reported. */
  @test()
  async relay_aRelayThatRevertsOnChainIsReported() {
    this.chain.minedAs = 'reverted'

    const holder = await this.holder()

    await this.relay(holder, await this.publication(holder))
    await this.relayer.settled()

    expect(this.reports).to.have.length(1)
    expect(String(this.reports[0])).to.contain('reverted')
  }

  /**
   * ID-07 acceptance 3: the ration counts publications only. Past it a
   * publication is a 429 with Retry-After, and a withdrawal still goes.
   */
  @test()
  async relay_rationsPublications_butNeverAWithdrawal() {
    this.parameters.identityRelayer.publishesPerDay = 2

    const holder = await this.holder()

    await this.relay(holder, await this.publication(holder))
    await this.relay(holder, await this.publication(holder, { version: 1 }))

    const limited = await this.relayFails(
      holder.user,
      await this.publication(holder, { version: 2 }),
    )

    expect(limited.status).to.equal(429)
    expect(limited.data.errors?.[0]).to.include({ reason: 'RateLimited' })

    const retryAfter = Number(limited.retryAfter)

    expect(retryAfter).to.be.greaterThan(23 * 3600)
    expect(retryAfter).to.be.at.most(24 * 3600)
    expect(limited.data.errors?.[0].retryAfterSeconds).to.equal(retryAfter)

    const withdrawn = await this.relay(holder, await this.withdrawal(holder, 2))

    expect(withdrawn.operation).to.equal('Deactivate')
    expect(this.chain.isActive(holder.wallet.address)).to.equal(false)

    // Another account's ration is its own.
    const other = await this.holder()

    await this.relay(other, await this.publication(other))
  }

  /** The ration is kept where every replica counts: two of them share it. */
  @test()
  async relay_twoReplicasShareOneRation() {
    this.parameters.identityRelayer.publishesPerDay = 1

    const holder = await this.holder()
    const replica = this.replica()

    await runPromise(
      replica.relay(holder.user, (await this.publication(holder)) as never),
    )

    const failure = await this.relayFails(
      holder.user,
      await this.publication(holder, { version: 1 }),
    )

    expect(failure.status).to.equal(429)
  }

  /**
   * Two replicas sending at once from one key, through a node whose pending
   * count has not seen either replica's last send - a load-balanced RPC. The
   * lock and the recorded last nonce give every transaction its own nonce,
   * and no send is ever refused for a nonce already taken.
   */
  @test()
  @timeout(20000)
  async relay_twoReplicasNeverSendTheSameNonce() {
    this.chain.automine = false
    this.chain.pendingLag = true

    const holders = await Promise.all([1, 2, 3, 4].map(() => this.holder()))
    const bodies = await Promise.all(
      holders.map((holder) => this.publication(holder)),
    )
    const replica = this.replica()

    await Promise.all(
      holders.map((holder, index) =>
        runPromise(
          (index % 2 === 0 ? this.relayer : replica).relay(
            holder.user,
            bodies[index] as never,
          ),
        ),
      ),
    )

    expect(
      this.chain.sent.map(({ gas }) => gas.nonce).sort((a, b) => a - b),
    ).to.deep.equal([0, 1, 2, 3])
    expect(this.chain.nonceClashes).to.equal(0)
    this.chain.mine()
  }

  /** A send the node dropped leaves no gap: its nonce is taken again. */
  @test()
  async relay_reusesTheNonceOfADroppedSend() {
    this.chain.automine = false
    this.chain.pendingLag = true

    const first = await this.holder()
    const sent = await this.relay(first, await this.publication(first))

    this.chain.drop(sent.transactionHash)

    const second = await this.holder()

    await this.relay(second, await this.publication(second))

    expect(this.chain.sent.map(({ gas }) => gas.nonce)).to.deep.equal([0])
    this.chain.mine()
  }

  @test()
  async relay_aWithdrawalCarriesNoCommitment_andAPublicationCarriesOne() {
    const holder = await this.holder()
    const body = await this.publication(holder)

    const bare = await this.relayFails(holder.user, {
      ...body,
      commitment: undefined,
    })

    expect(bare.status).to.equal(400)

    const withdrawal = await this.withdrawal(holder, 0)
    const padded = await this.relayFails(holder.user, {
      ...withdrawal,
      commitment: COMMITMENT,
      schemaId: 1,
    })

    expect(padded.status).to.equal(400)
    expect(this.chain.sent).to.have.length(0)
  }

  @test()
  async relay_refusesASubjectWhoseChecksumIsWrong_with400() {
    const holder = await this.holder()
    const body = await this.publication(holder)
    const lower = holder.wallet.address.toLowerCase()
    // Upper-case one letter the checksum keeps lower: no longer EIP-55.
    const index = [...lower].findIndex(
      (char, at) =>
        at > 1 && /[a-f]/.test(char) && holder.wallet.address[at] === char,
    )
    const broken = `${lower.slice(0, index)}${lower[index].toUpperCase()}${lower.slice(index + 1)}`

    const failure = await this.relayFails(holder.user, {
      ...body,
      subject: broken,
    })

    expect(failure.status).to.equal(400)
    expect(this.chain.sent).to.have.length(0)
  }

  @test()
  async relay_refusesAnAccountTheRegistryCannotKey() {
    const holder = await this.holder()
    const body = await this.publication(holder)
    const solana = await this.userFixture.createUser()

    solana.address = bs58.encode(sign.keyPair().publicKey)
    await runPromise(this.userRepository.saveSingle(solana))

    const failure = await this.relayFails(solana, body)

    expect(failure.status).to.equal(422)
    expect(failure.data.errors).to.deep.equal([
      { reason: 'UnsupportedSubjectScheme' },
    ])
    expect(this.chain.sent).to.have.length(0)
  }

  @test()
  nextNonce_isThePendingCountUnlessTheLastSendIsAheadOfIt() {
    expect(IdentityRelayer.nextNonce(4, null, false)).to.equal(4)
    expect(
      IdentityRelayer.nextNonce(4, { nonce: 2, txHash: '0x' }, true),
    ).to.equal(4)
    expect(
      IdentityRelayer.nextNonce(4, { nonce: 4, txHash: '0x' }, true),
    ).to.equal(5)
    expect(
      IdentityRelayer.nextNonce(4, { nonce: 6, txHash: '0x' }, true),
    ).to.equal(7)
    // Dropped: the node's count is the truth, and the gap is filled.
    expect(
      IdentityRelayer.nextNonce(4, { nonce: 4, txHash: '0x' }, false),
    ).to.equal(4)
  }

  /**
   * A second API replica: its own relayer instance, sharing only what
   * replicas share - the database, Redis and the chain.
   */
  private replica(): IdentityRelayer {
    const replica = new IdentityRelayer()

    Object.assign(replica, {
      parameters: this.parameters,
      redisClient: this.container.get<RedisClient>('RedisClient'),
      advisoryLock: this.container.get<AdvisoryLock>('AdvisoryLock'),
      chainFactory: this.chainFactory,
      report: (error: unknown) => this.reports.push(error),
    })

    return replica
  }

  /** A fresh account with an EVM wallet the suite holds the key of, and no ETH. */
  private async holder(): Promise<IHolder> {
    const wallet = new Wallet(Wallet.createRandom().privateKey)
    const user = await this.userFixture.createUser()

    user.address = wallet.address

    return {
      user: await runPromise(this.userRepository.saveSingle(user)),
      wallet,
    }
  }

  /** A publication the holder signs, as their browser would. */
  private async publication(
    holder: IHolder,
    options: {
      signer?: Wallet
      commitment?: string
      version?: number
      deadline?: number
    } = {},
  ): Promise<IdentityRelayDto & { deadline: number; signature: string }> {
    const expectedVersion = options.version ?? 0
    const commitment = options.commitment ?? COMMITMENT
    const deadline = options.deadline ?? this.chain.now + 3600
    const payload = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'uint32', 'uint32'],
        [commitment, 1, expectedVersion],
      ),
    )
    const signature = await this.sign(
      options.signer ?? holder.wallet,
      0,
      holder.wallet.address,
      payload,
      deadline,
    )

    return {
      operation: 'Publish',
      subject: holder.wallet.address,
      commitment,
      schemaId: 1,
      expectedVersion,
      deadline,
      signature,
    }
  }

  private async withdrawal(
    holder: IHolder,
    expectedVersion: number,
  ): Promise<IdentityRelayDto & { deadline: number; signature: string }> {
    const deadline = this.chain.now + 3600
    const payload = keccak256(
      AbiCoder.defaultAbiCoder().encode(['uint32'], [expectedVersion]),
    )

    return {
      operation: 'Deactivate',
      subject: holder.wallet.address,
      expectedVersion,
      deadline,
      signature: await this.sign(
        holder.wallet,
        1,
        holder.wallet.address,
        payload,
        deadline,
      ),
    }
  }

  private async sign(
    signer: Wallet,
    operation: number,
    subject: string,
    payload: string,
    deadline: number,
  ): Promise<string> {
    return signer.signTypedData(
      {
        name: 'WorkAddressIdentityRegistry',
        version: '1',
        chainId: CHAIN_ID,
        verifyingContract: getAddress(REGISTRY),
      },
      ACTION_TYPES,
      {
        operation,
        subject,
        payload,
        nonce: await this.chain.subjectNonce(subject),
        deadline,
      },
    )
  }

  private async relay(holder: IHolder, body: IdentityRelayDto) {
    return (
      await userControllerRelayIdentity({
        client: this.apiClient(),
        headers: this.auth(holder.user),
        body,
        throwOnError: true,
      })
    ).data
  }

  private async relayFails(
    user: User,
    body: IdentityRelayDto,
  ): Promise<IFailure> {
    try {
      await userControllerRelayIdentity({
        client: this.apiClient(),
        headers: this.auth(user),
        body,
        throwOnError: true,
      })
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) throw error

      return {
        status: error.response?.status,
        retryAfter: error.response?.headers['retry-after'] as
          | string
          | undefined,
        data: error.response?.data as IFailure['data'],
      }
    }

    throw new Error('The relay was expected to be refused')
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }
}

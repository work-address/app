import fs from 'fs'
import { expect } from 'chai'
import axios from 'axios'
import {
  AbiCoder,
  Contract,
  HDNodeWallet,
  isError,
  JsonRpcProvider,
  keccak256,
  Mnemonic,
  Wallet,
} from 'ethers'
import { skip, suite, test, timeout } from '@testdeck/mocha'

import {
  identityControllerConfig,
  userControllerPublishIdentity,
  userControllerRelayIdentity,
} from '@app/api-client'
import type { IdentityPublishDto, IdentityRelayDto } from '@app/api-client'

import { User } from '@/entity/user'
import { IConfigParameters } from '@/model/config'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'
import { IdentityReadCache } from '@/service/identity-read-cache'
import { IdentityRelayer } from '@/service/identity-relayer'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import {
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  evmSubject,
  serializeDocument,
} from '@/vendor/identity'
import type { ProfileFields } from '@/vendor/identity'

/**
 * The deployment manifest `pnpm run deploy:localhost` wrote in app/contracts
 * (deployments/localhost.json). Without it this suite is skipped: it needs a
 * running `pnpm run node` with that deployment on it.
 */
const MANIFEST = process.env.IDENTITY_TEST_MANIFEST ?? ''
const RPC_URL = process.env.IDENTITY_TEST_RPC_URL ?? 'http://127.0.0.1:8545'

/** The only chain this suite may send to: a local Hardhat node. */
const LOCAL_CHAIN_ID = 31337

/** Hardhat's public test mnemonic; `hardhat node` prints every key it derives. */
const HARDHAT_MNEMONIC =
  'test test test test test test test test test test test junk'

/**
 * The relayer: Hardhat's eighth account, which no other suite here sends
 * from, so its nonce is the relayer's alone. Its key is in the public
 * mnemonic and holds nothing outside this node.
 */
const RELAYER_ACCOUNT = 7

const REGISTRY_ABI = [
  'function publishFor(address subject, bytes32 commitment, uint32 schemaId, uint32 expectedVersion, uint64 deadline, bytes subjectSignature)',
  'function versionCount(address subject) view returns (uint32)',
  'function nonces(address subject) view returns (uint256)',
  'function readIdentity(address subject) view returns (uint32 version, uint8 status, uint32 schemaId, bytes32 commitment, uint64 updatedAt)',
  'error InvalidAuthorization()',
]

/** IdentityRegistry.ACTION_TYPEHASH's struct, written out rather than borrowed from the service. */
const ACTION_TYPES = {
  Action: [
    { name: 'operation', type: 'uint8' },
    { name: 'subject', type: 'address' },
    { name: 'payload', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
}

const FIELDS: ProfileFields = {
  name: 'Katherine Johnson',
  title: 'Mathematician',
  skills: ['Orbital mechanics'],
}

interface ILocalManifest {
  chainId: number
  deployBlock: number
  identityRegistry: { address: string }
}

interface IHolder {
  user: User
  wallet: Wallet
}

interface IFailure {
  status: number | undefined
  data: { errors?: Record<string, unknown>[] }
}

/**
 * WP-122 on a `hardhat node` running the real IdentityRegistry: a holder
 * whose wallet has never held a wei publishes through the relay, which pays
 * the gas from its own key; a signature for another subject, a forged one
 * and a replayed one are refused before the relayer sends anything - and
 * the registry refuses the same forged and replayed authorizations itself
 * when anyone sends them; and a withdrawal goes through past the ration.
 * The suite refuses any chain but 31337 and sends nothing anywhere else.
 *
 * Run: in app/contracts, `pnpm run node` and `pnpm run deploy:localhost`;
 * then here `IDENTITY_TEST_MANIFEST=<contracts>/deployments/localhost.json
 * pnpm test`.
 */
@suite
@skip(!MANIFEST)
export class UserControllerIdentityRelayNodeTest extends BaseControllerTest {
  private provider: JsonRpcProvider
  private manifest: ILocalManifest
  private relayerWallet: HDNodeWallet
  private funder: HDNodeWallet
  private savedIdentity: IConfigParameters['identity']
  private savedRelayer: IConfigParameters['identityRelayer']

  private get userRepository(): UserRepository {
    return this.container.get('UserRepository')
  }

  private get relayer(): IdentityRelayer {
    return this.container.get('IdentityRelayer')
  }

  @timeout(20000)
  async before() {
    await super.before()

    this.manifest = JSON.parse(
      fs.readFileSync(MANIFEST, 'utf8'),
    ) as ILocalManifest
    this.provider = new JsonRpcProvider(RPC_URL, undefined, {
      staticNetwork: true,
      cacheTimeout: -1,
    })

    const chainId = Number((await this.provider.getNetwork()).chainId)

    if (
      chainId !== LOCAL_CHAIN_ID ||
      this.manifest.chainId !== LOCAL_CHAIN_ID
    ) {
      throw new Error(
        `Refusing chain ${chainId} (manifest ${this.manifest.chainId}): this suite only sends to a local Hardhat node, ${LOCAL_CHAIN_ID}`,
      )
    }

    const account = (index: number) =>
      HDNodeWallet.fromMnemonic(
        Mnemonic.fromPhrase(HARDHAT_MNEMONIC),
        `m/44'/60'/0'/0/${index}`,
      ).connect(this.provider)

    this.funder = account(0)
    this.relayerWallet = account(RELAYER_ACCOUNT)
    this.container.get<IdentityReadCache>('IdentityReadCache').ttlMs = 0

    this.savedIdentity = { ...this.parameters.identity }
    this.savedRelayer = { ...this.parameters.identityRelayer }
    Object.assign(this.parameters.identity, {
      chainId: LOCAL_CHAIN_ID,
      registryAddress: this.manifest.identityRegistry.address,
      rpcUrl: RPC_URL,
      manifestUrl: '',
      deployBlock: this.manifest.deployBlock,
    })
    Object.assign(this.parameters.identityRelayer, {
      key: this.relayerWallet.privateKey,
      gasLimit: 250_000,
      maxFeeGwei: 100,
      publishesPerDay: 5,
    })
  }

  @timeout(60000)
  async after() {
    await this.relayer.settled()

    if (this.savedIdentity) {
      Object.assign(this.parameters.identity, this.savedIdentity)
      Object.assign(this.parameters.identityRelayer, this.savedRelayer)
    }

    this.provider?.destroy()
    await super.after()
  }

  /**
   * ID-07 acceptance 1: a holder with zero ETH publishes v1 through the
   * relay. The relayer's balance goes down by exactly what the transaction
   * cost, the holder's stays at zero, and the API then hosts the version
   * the registry calls current.
   */
  @test
  @timeout(60000)
  async node_aHolderWithNoEthPublishesThroughTheRelay() {
    const config = await identityControllerConfig({
      client: this.apiClient(),
      throwOnError: true,
    })

    expect(config.data.relayEnabled).to.equal(true)

    const holder = await this.holder()
    const relayerBefore = await this.provider.getBalance(
      this.relayerWallet.address,
    )

    expect(await this.provider.getBalance(holder.wallet.address)).to.equal(
      BigInt(0),
    )

    const { relay, host } = await this.publication(holder)
    const relayed = await this.relay(holder, relay)
    const receipt = await this.provider.waitForTransaction(
      relayed.transactionHash,
    )

    expect(relayed.relayer).to.equal(this.relayerWallet.address)
    expect(receipt?.status).to.equal(1)
    expect(receipt?.from).to.equal(this.relayerWallet.address)
    expect(await this.provider.getBalance(holder.wallet.address)).to.equal(
      BigInt(0),
    )
    expect(
      relayerBefore -
        (await this.provider.getBalance(this.relayerWallet.address)),
    ).to.equal(
      (receipt?.gasUsed ?? BigInt(0)) * (receipt?.gasPrice ?? BigInt(0)),
    )
    expect(
      Number(await this.registry().versionCount(holder.wallet.address)),
    ).to.equal(1)

    const hosted = await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(holder.user),
      body: host,
      throwOnError: true,
    })

    expect(hosted.data.version).to.equal(1)
    expect(hosted.data.status.result).to.equal('Current')
  }

  /**
   * ID-07 acceptance 2: a signature for another subject, and one forged by
   * another key over the holder's own subject, are refused before the
   * relayer sends anything - its transaction count does not move.
   */
  @test
  @timeout(60000)
  async node_refusesAnotherSubjectAndAForgery_beforeBroadcast() {
    const holder = await this.holder()
    const other = await this.holder()
    const sentBefore = await this.relayerNonce()

    const { relay } = await this.publication(holder)
    const notTheirs = await this.relayFails(other.user, relay)

    expect(notTheirs.status).to.equal(403)

    const forged = await this.publication(holder, {
      signer: new Wallet(Wallet.createRandom().privateKey),
    })
    const forgery = await this.relayFails(holder.user, forged.relay)

    expect(forgery.status).to.equal(422)
    expect(forgery.data.errors).to.deep.equal([
      { reason: 'InvalidAuthorization' },
    ])
    expect(await this.relayerNonce()).to.equal(sentBefore)
    expect(
      Number(await this.registry().versionCount(holder.wallet.address)),
    ).to.equal(0)

    // The registry refuses the same forgery from anyone who sends it.
    expect(await this.revertOnChain(forged.relay)).to.equal(
      'InvalidAuthorization',
    )
  }

  /**
   * A replayed authorization: once mined, the same request is refused by
   * the relayer without a second send, and the registry refuses the very
   * same arguments sent by anyone else.
   */
  @test
  @timeout(60000)
  async node_refusesAReplayedAuthorization_offChainAndOnChain() {
    const holder = await this.holder()
    const { relay } = await this.publication(holder)
    const relayed = await this.relay(holder, relay)

    await this.provider.waitForTransaction(relayed.transactionHash)

    const sentBefore = await this.relayerNonce()
    const replay = await this.relayFails(holder.user, relay)

    expect(replay.status).to.equal(422)
    expect(replay.data.errors).to.deep.equal([
      { reason: 'InvalidAuthorization' },
    ])
    expect(await this.relayerNonce()).to.equal(sentBefore)
    expect(await this.revertOnChain(relay)).to.equal('InvalidAuthorization')
    expect(
      Number(await this.registry().versionCount(holder.wallet.address)),
    ).to.equal(1)
  }

  /**
   * ID-07 acceptance 3: with the ration spent on publications, a relayed
   * withdrawal still goes through, and the registry reads the record as
   * withdrawn.
   */
  @test
  @timeout(90000)
  async node_aWithdrawalIsNeverRefusedForTheRation() {
    this.parameters.identityRelayer.publishesPerDay = 1

    try {
      const holder = await this.holder()
      const first = await this.publication(holder)

      await this.provider.waitForTransaction(
        (await this.relay(holder, first.relay)).transactionHash,
      )

      const second = await this.publication(holder, { version: 1 })
      const limited = await this.relayFails(holder.user, second.relay)

      expect(limited.status).to.equal(429)

      const withdrawal = await this.withdrawal(holder, 1)
      const relayed = await this.relay(holder, withdrawal)
      const receipt = await this.provider.waitForTransaction(
        relayed.transactionHash,
      )

      expect(receipt?.status).to.equal(1)

      const [version, status] = (await this.registry().readIdentity(
        holder.wallet.address,
      )) as [bigint, bigint]

      expect(Number(version)).to.equal(1)
      expect(Number(status)).to.equal(2) // Deactivated
      expect(await this.provider.getBalance(holder.wallet.address)).to.equal(
        BigInt(0),
      )
    } finally {
      this.parameters.identityRelayer.publishesPerDay = 5
    }
  }

  /** ID-07 acceptance 4: no key, no relay - reported as off, and refused. */
  @test
  @timeout(60000)
  async node_withoutAKeyTheRelayIsOff() {
    const key = this.parameters.identityRelayer.key

    this.parameters.identityRelayer.key = ''

    try {
      const config = await identityControllerConfig({
        client: this.apiClient(),
        throwOnError: true,
      })

      expect(config.data).to.include({ enabled: true, relayEnabled: false })

      const holder = await this.holder()
      const sentBefore = await this.relayerNonce()
      const failure = await this.relayFails(
        holder.user,
        (await this.publication(holder)).relay,
      )

      expect(failure.status).to.equal(503)
      expect(failure.data.errors).to.deep.equal([{ reason: 'RelayDisabled' }])
      expect(await this.relayerNonce()).to.equal(sentBefore)
    } finally {
      this.parameters.identityRelayer.key = key
    }
  }

  /** A fresh wallet that is never sent a wei, and an app account for it. */
  private async holder(): Promise<IHolder> {
    const wallet = new Wallet(Wallet.createRandom().privateKey)
    const user = await this.userFixture.createUser()

    user.address = wallet.address

    return {
      user: await runPromise(this.userRepository.saveSingle(user)),
      wallet,
    }
  }

  /**
   * Builds the holder's tree, as their browser does, and signs a relayed
   * publication of its commitment as the next version: the relay body, and
   * the PUT body to host it once mined.
   */
  private async publication(
    holder: IHolder,
    options: { signer?: Wallet; version?: number } = {},
  ): Promise<{ relay: IdentityRelayDto; host: IdentityPublishDto }> {
    const current =
      options.version ??
      Number(await this.registry().versionCount(holder.wallet.address))
    const tree = buildProfileTree({
      subject: evmSubject(holder.wallet.address, LOCAL_CHAIN_ID),
      fields: FIELDS,
    })
    const presentation = createAnchoredPresentation(tree, {
      disclose: ['name', 'skills'],
      anchor: {
        chainId: LOCAL_CHAIN_ID,
        registry: this.manifest.identityRegistry.address,
        version: current + 1,
      },
    })
    const commitment = presentation.commitment as string
    const deadline = (await this.chainTime()) + 3600
    const payload = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'uint32', 'uint32'],
        [commitment, 1, current],
      ),
    )

    return {
      relay: {
        operation: 'Publish',
        subject: holder.wallet.address,
        commitment,
        schemaId: 1,
        expectedVersion: current,
        deadline,
        signature: await this.sign(
          options.signer ?? holder.wallet,
          0,
          holder.wallet.address,
          payload,
          deadline,
        ),
      },
      host: {
        presentation: JSON.parse(serializeDocument(presentation)) as Record<
          string,
          unknown
        >,
        export: JSON.parse(
          serializeDocument(createProfileExport(tree)),
        ) as Record<string, unknown>,
      },
    }
  }

  private async withdrawal(
    holder: IHolder,
    expectedVersion: number,
  ): Promise<IdentityRelayDto> {
    const deadline = (await this.chainTime()) + 3600

    return {
      operation: 'Deactivate',
      subject: holder.wallet.address,
      expectedVersion,
      deadline,
      signature: await this.sign(
        holder.wallet,
        1,
        holder.wallet.address,
        keccak256(
          AbiCoder.defaultAbiCoder().encode(['uint32'], [expectedVersion]),
        ),
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
        chainId: LOCAL_CHAIN_ID,
        verifyingContract: this.manifest.identityRegistry.address,
      },
      ACTION_TYPES,
      {
        operation,
        subject,
        payload,
        nonce: (await this.registry().nonces(subject)) as bigint,
        deadline,
      },
    )
  }

  /**
   * Sends `publishFor` with exactly these arguments from Hardhat's first
   * account, which is not the relayer, and returns the registry error it
   * reverts with (null if it would not revert).
   */
  private async revertOnChain(body: IdentityRelayDto): Promise<string | null> {
    try {
      await this.registry(this.funder).publishFor.estimateGas(
        body.subject,
        body.commitment,
        body.schemaId,
        body.expectedVersion,
        body.deadline,
        body.signature,
      )

      return null
    } catch (error: unknown) {
      if (!isError(error, 'CALL_EXCEPTION')) throw error

      return error.revert?.name ?? null
    }
  }

  private registry(runner: HDNodeWallet | JsonRpcProvider = this.provider) {
    return new Contract(
      this.manifest.identityRegistry.address,
      REGISTRY_ABI,
      runner,
    )
  }

  private relayerNonce(): Promise<number> {
    return this.provider.getTransactionCount(
      this.relayerWallet.address,
      'pending',
    )
  }

  private async chainTime(): Promise<number> {
    return (await this.provider.getBlock('latest'))?.timestamp ?? 0
  }

  private async relay(holder: IHolder, body: IdentityRelayDto) {
    const res = await userControllerRelayIdentity({
      client: this.apiClient(),
      headers: this.auth(holder.user),
      body,
      throwOnError: true,
    })

    expect(res.status).to.equal(202)

    return res.data
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
        data: error.response?.data as IFailure['data'],
      }
    }

    throw new Error('The relay was expected to be refused')
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }
}

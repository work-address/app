import fs from 'fs'
import { expect } from 'chai'
import axios from 'axios'
import bs58 from 'bs58'
import {
  Contract,
  HDNodeWallet,
  JsonRpcProvider,
  Mnemonic,
  Wallet,
  parseEther,
} from 'ethers'
import { sign } from 'tweetnacl'
import { skip, suite, test, timeout } from '@testdeck/mocha'

import {
  authControllerStatus,
  userControllerPublishIdentity,
  userControllerRead,
  userControllerReadIdentity,
  userControllerRemoveIdentity,
  userControllerSearch,
} from '@app/api-client'
import type { IdentityPublishDto } from '@app/api-client'

import { User } from '@/entity/user'
import { IConfigParameters } from '@/model/config'
import { UserRepository } from '@/repository/user-repository'
import { IdentityReadCache } from '@/service/identity-read-cache'
import { runPromise } from '@/service/effect-bridge'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import {
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  evmSubject,
  serializeDocument,
} from '@/vendor/identity'
import type { ProfileFields, ProfilePresentation } from '@/vendor/identity'

/**
 * The deployment manifest `npm run deploy:localhost` wrote in the contracts
 * repository (deployments/localhost.json). Without it this suite is skipped:
 * it needs a running `npm run node` with that deployment on it.
 */
const MANIFEST = process.env.IDENTITY_TEST_MANIFEST ?? ''
const RPC_URL = process.env.IDENTITY_TEST_RPC_URL ?? 'http://127.0.0.1:8545'

/** The only chain this suite may send to: a local Hardhat node. */
const LOCAL_CHAIN_ID = 31337

/** Hardhat's public test mnemonic; `hardhat node` prints every key it derives. */
const HARDHAT_MNEMONIC =
  'test test test test test test test test test test test junk'

const REGISTRY_ABI = [
  'function publish(bytes32 commitment, uint32 schemaId, uint32 expectedVersion)',
  'function deactivate(uint32 expectedVersion)',
  'function versionCount(address subject) view returns (uint32)',
  'function readIdentity(address subject) view returns (uint32 version, uint8 status, uint32 schemaId, bytes32 commitment, uint64 updatedAt)',
]

const FIELDS: ProfileFields = {
  name: 'Grace Hopper',
  title: 'Rear Admiral',
  skills: ['COBOL', 'Compilers'],
  rate: { currency: 'USDT', rateHourCents: 20000 },
}

interface ILocalManifest {
  chainId: number
  deployBlock: number
  identityRegistry: { address: string }
}

interface IHolder {
  user: User
  wallet: HDNodeWallet | Wallet
}

interface IFailure {
  status: number | undefined
  data: { errors?: Record<string, unknown>[] }
}

/**
 * ID-05 against the real IdentityRegistry on a `hardhat node`: every holder
 * is a fresh wallet funded from Hardhat's first account, publishes and
 * withdraws with its own transactions, and the API reads the contract over
 * JSON-RPC with nothing stubbed. The suite refuses to start against any chain
 * but 31337, and sends nothing anywhere else.
 *
 * Run: in contracts, `npm run node` and `npm run deploy:localhost`; then here
 * `IDENTITY_TEST_MANIFEST=<contracts>/deployments/localhost.json pnpm test`.
 */
@suite
@skip(!MANIFEST)
export class UserControllerIdentityNodeTest extends BaseControllerTest {
  private provider: JsonRpcProvider
  private funder: HDNodeWallet
  private manifest: ILocalManifest
  private savedIdentity: IConfigParameters['identity']

  private get userRepository(): UserRepository {
    return this.container.get('UserRepository')
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

    this.funder = HDNodeWallet.fromMnemonic(
      Mnemonic.fromPhrase(HARDHAT_MNEMONIC),
      "m/44'/60'/0'/0/0",
    ).connect(this.provider)

    // The identity read cache is off for this suite: every case here is about
    // what the chain says at a given moment, and several change the registry
    // from outside this instance - which is exactly the change a cache is
    // allowed to answer late. user-controller.identity-cache.test covers the
    // cache itself.
    this.container.get<IdentityReadCache>('IdentityReadCache').ttlMs = 0

    this.savedIdentity = { ...this.parameters.identity }
    Object.assign(this.parameters.identity, {
      chainId: LOCAL_CHAIN_ID,
      registryAddress: this.manifest.identityRegistry.address,
      rpcUrl: RPC_URL,
      manifestUrl: '',
      deployBlock: this.manifest.deployBlock,
    })
  }

  @timeout(20000)
  async after() {
    if (this.savedIdentity) {
      Object.assign(this.parameters.identity, this.savedIdentity)
    }

    this.provider?.destroy()
    await super.after()
  }

  /** ID-05 case 1: user A cannot host user B's presentation (SC-A01). */
  @test
  @timeout(60000)
  async node_refusesAnotherSubjectsPresentation() {
    const holder = await this.holder()
    const other = await this.holder()
    const body = await this.publishOnChain(holder)

    expect((await this.publishFails(other.user, body)).status).to.equal(403)
  }

  /** ID-05 case 2: one changed character does not open against the root. */
  @test
  @timeout(60000)
  async node_refusesATamperedValue() {
    const holder = await this.holder()
    const body = await this.publishOnChain(holder)
    const presentation = body.presentation as unknown as ProfilePresentation
    const name = presentation.disclosures.find(
      ({ pointer }) => pointer === '/name',
    )

    if (!name) {
      throw new Error('The name is disclosed')
    }

    name.value = 'Grace Murray'

    const failure = await this.publishFails(holder.user, body)

    expect(failure.status).to.equal(422)
    expect(failure.data.errors).to.deep.equal([{ reason: 'InvalidProof' }])
  }

  /**
   * ID-05 case 3, the documented rule: a version the chain holds but has
   * superseded is refused, and the current one is hosted, with the history
   * read from the registry's own events.
   */
  @test
  @timeout(60000)
  async node_refusesASupersededVersion_andHostsTheCurrentOne() {
    const holder = await this.holder()
    const first = await this.publishOnChain(holder)
    const second = await this.publishOnChain(holder, {
      ...FIELDS,
      title: 'Commodore',
    })

    const failure = await this.publishFails(holder.user, first)

    expect(failure.status).to.equal(409)
    expect(failure.data.errors).to.deep.equal([
      { result: 'Superseded', subjectDeactivated: false },
    ])

    const published = await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(holder.user),
      body: second,
      throwOnError: true,
    })

    expect(published.data.version).to.equal(2)
    expect(published.data.status.result).to.equal('Current')
    expect(published.data.status.checkedAtBlock).to.be.a('number')
    expect(
      published.data.history?.map(({ kind, version }) => ({ kind, version })),
    ).to.deep.equal([
      { kind: 'PUBLISHED', version: 1 },
      { kind: 'PUBLISHED', version: 2 },
    ])
  }

  /**
   * WP-119's local-node run, end to end: v1, v2, a withdrawal from the
   * holder's own wallet, then v3. At every step the API hosts the version the
   * registry calls current and no other, and the history it shows is the
   * registry's own events rather than anything stored here.
   */
  @test
  @timeout(120000)
  async node_runsThroughV1ThenV2ThenWithdrawalThenV3() {
    const holder = await this.holder()

    const first = await this.publishOnChain(holder)
    const hostedV1 = await this.host(holder, first)

    expect(hostedV1.version).to.equal(1)
    expect(hostedV1.status.result).to.equal('Current')
    expect(hostedV1.status.subjectDeactivated).to.equal(false)

    const second = await this.publishOnChain(holder, {
      ...FIELDS,
      title: 'Commodore',
    })
    const hostedV2 = await this.host(holder, second)

    expect(hostedV2.version).to.equal(2)
    expect(hostedV2.status.result).to.equal('Current')
    expect(UserControllerIdentityNodeTest.events(hostedV2.history)).to.deep.equal(
      [
        { kind: 'PUBLISHED', version: 1 },
        { kind: 'PUBLISHED', version: 2 },
      ],
    )

    // The withdrawal is the holder's own transaction; this service cannot
    // send it and does not learn about it until it reads the chain again.
    await (await this.registry(holder.wallet).deactivate(2)).wait()

    const withdrawn = await this.read(holder)

    expect(withdrawn.version).to.equal(2)
    expect(withdrawn.status.result).to.equal('Deactivated')
    expect(withdrawn.status.subjectDeactivated).to.equal(true)
    expect(
      UserControllerIdentityNodeTest.events(withdrawn.history),
    ).to.deep.equal([
      { kind: 'PUBLISHED', version: 1 },
      { kind: 'PUBLISHED', version: 2 },
      { kind: 'DEACTIVATED', version: 2 },
    ])

    // Republishing after a withdrawal appends a version rather than undoing
    // the withdrawal: the chain keeps both, and the record is active again.
    const third = await this.publishOnChain(holder, {
      ...FIELDS,
      title: 'Rear Admiral, retired',
    })
    const hostedV3 = await this.host(holder, third)

    expect(hostedV3.version).to.equal(3)
    expect(hostedV3.status.result).to.equal('Current')
    expect(hostedV3.status.subjectDeactivated).to.equal(false)
    expect(UserControllerIdentityNodeTest.events(hostedV3.history)).to.deep.equal(
      [
        { kind: 'PUBLISHED', version: 1 },
        { kind: 'PUBLISHED', version: 2 },
        { kind: 'DEACTIVATED', version: 2 },
        { kind: 'PUBLISHED', version: 3 },
      ],
    )

    // And the superseded versions are refused as such, one run later.
    expect((await this.publishFails(holder.user, first)).status).to.equal(409)
    expect((await this.publishFails(holder.user, second)).status).to.equal(409)
  }

  /** ID-05 case 4: after a chain withdrawal, never Current. */
  @test
  @timeout(60000)
  async node_readsAWithdrawalAsDeactivated() {
    const holder = await this.holder()
    const body = await this.publishOnChain(holder)

    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(holder.user),
      body,
      throwOnError: true,
    })
    await (await this.registry(holder.wallet).deactivate(0)).wait()

    const read = await userControllerReadIdentity({
      client: this.apiClient(),
      path: { address: holder.user.address as never },
      throwOnError: true,
    })

    expect(read.data.status.result).to.equal('Deactivated')
    expect(read.data.status.subjectDeactivated).to.equal(true)
    expect(read.data.history?.map(({ kind }) => kind)).to.deep.equal([
      'PUBLISHED',
      'DEACTIVATED',
    ])
  }

  /** ID-05 case 5: a Solana account cannot anchor. */
  @test
  @timeout(60000)
  async node_refusesASolanaAccount() {
    const holder = await this.holder()
    const body = await this.publishOnChain(holder)
    const solana = await this.userFixture.createUser()

    solana.address = bs58.encode(sign.keyPair().publicKey)
    await runPromise(this.userRepository.saveSingle(solana))

    const failure = await this.publishFails(solana, body)

    expect(failure.status).to.equal(422)
    expect(failure.data.errors).to.deep.equal([
      { reason: 'UnsupportedSubjectScheme' },
    ])
  }

  /**
   * ID-05 cases 6 and 7: DELETE takes the hosted copy down while the chain
   * still reads the version, and the identity columns are never in the
   * public read, a search row or the holder's own record.
   */
  @test
  @timeout(60000)
  async node_removesTheHostedCopyOnly_andNeverSerializesIt() {
    const holder = await this.holder()
    const searcher = await this.holder()
    const body = await this.publishOnChain(holder)
    const commitment = (body.presentation as { commitment: string }).commitment

    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(holder.user),
      body,
      throwOnError: true,
    })

    for (const data of [
      (
        await userControllerRead({
          client: this.apiClient(),
          path: { address: holder.user.address as never },
          throwOnError: true,
        })
      ).data,
      (
        await userControllerSearch({
          client: this.apiClient(),
          headers: this.auth(searcher.user),
          body: {
            filter: { id: holder.user.id },
            sort: { createdAt: 'ASC' },
            page: 0,
          },
          throwOnError: true,
        })
      ).data,
      (
        await authControllerStatus({
          client: this.apiClient(),
          headers: this.auth(holder.user),
          throwOnError: true,
        })
      ).data,
    ]) {
      expect(JSON.stringify(data)).to.not.contain('identity')
      expect(JSON.stringify(data)).to.not.contain(commitment)
    }

    const removed = await userControllerRemoveIdentity({
      client: this.apiClient(),
      headers: this.auth(holder.user),
      throwOnError: true,
    })

    expect(removed.data.chainUnchanged).to.equal(true)
    expect(await this.readIdentityStatus(holder.user.address)).to.equal(404)

    const [version, status, , onChain] = (await this.registry().readIdentity(
      holder.user.address,
    )) as [bigint, bigint, bigint, string]

    expect(Number(version)).to.equal(1)
    expect(Number(status)).to.equal(1) // Active
    expect(onChain).to.equal(commitment)
  }

  /** PUT /user/identity, expecting it to be hosted. */
  private async host(holder: IHolder, body: IdentityPublishDto) {
    return (
      await userControllerPublishIdentity({
        client: this.apiClient(),
        headers: this.auth(holder.user),
        body,
        throwOnError: true,
      })
    ).data
  }

  /** GET /user/:address/identity, anonymously, as any reader would. */
  private async read(holder: IHolder) {
    return (
      await userControllerReadIdentity({
        client: this.apiClient(),
        path: { address: holder.user.address as never },
        throwOnError: true,
      })
    ).data
  }

  /** The history as the run cares about it: what happened, and to which version. */
  private static events(
    history: { kind: string; version: number }[] | null | undefined,
  ) {
    return history?.map(({ kind, version }) => ({ kind, version }))
  }

  /** A fresh wallet with gas, and an app account for it. */
  private async holder(): Promise<IHolder> {
    const wallet = Wallet.createRandom().connect(this.provider)

    await (
      await this.funder.sendTransaction({
        to: wallet.address,
        value: parseEther('1'),
      })
    ).wait()

    const user = await this.userFixture.createUser()

    user.address = wallet.address

    return {
      user: await runPromise(this.userRepository.saveSingle(user)),
      wallet,
    }
  }

  /**
   * Builds a tree for the holder, publishes its commitment from the holder's
   * own wallet as the next version, and returns the PUT body for it.
   */
  private async publishOnChain(
    holder: IHolder,
    fields: ProfileFields = FIELDS,
  ): Promise<IdentityPublishDto> {
    const registry = this.registry(holder.wallet)
    const current = Number(await registry.versionCount(holder.wallet.address))
    const tree = buildProfileTree({
      subject: evmSubject(holder.wallet.address, LOCAL_CHAIN_ID),
      fields,
    })
    const presentation = createAnchoredPresentation(tree, {
      disclose: ['name', 'skills', 'rate'],
      anchor: {
        chainId: LOCAL_CHAIN_ID,
        registry: this.manifest.identityRegistry.address,
        version: current + 1,
      },
    })

    await (await registry.publish(presentation.commitment, 1, current)).wait()

    return {
      presentation: JSON.parse(serializeDocument(presentation)) as Record<
        string,
        unknown
      >,
      export: JSON.parse(
        serializeDocument(createProfileExport(tree)),
      ) as Record<string, unknown>,
    }
  }

  private registry(runner?: HDNodeWallet | Wallet) {
    return new Contract(
      this.manifest.identityRegistry.address,
      REGISTRY_ABI,
      runner ?? this.provider,
    )
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  private async publishFails(
    user: User,
    body: IdentityPublishDto,
  ): Promise<IFailure> {
    try {
      await userControllerPublishIdentity({
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

    throw new Error('The publish was expected to fail')
  }

  private async readIdentityStatus(
    address: string,
  ): Promise<number | undefined> {
    try {
      return (
        await userControllerReadIdentity({
          client: this.apiClient(),
          path: { address: address as never },
          throwOnError: true,
        })
      ).status
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) throw error

      return error.response?.status
    }
  }
}

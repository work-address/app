import { expect } from 'chai'
import axios from 'axios'
import bs58 from 'bs58'
import { randomBytes } from 'crypto'
import { Wallet } from 'ethers'
import { Address } from '@ton/core'
import { sign } from 'tweetnacl'
import { suite, test, timeout } from '@testdeck/mocha'

import {
  authControllerStatus,
  userControllerEdit,
  userControllerIdentityExport,
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
import { runPromise } from '@/service/effect-bridge'
import { IdentityChainFactory } from '@/service/identity-chain-factory'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { IdentityRegistryFake } from '@/test/fixture/identity-registry-fake'
import {
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  createSelfSignedPresentation,
  evmSubject,
  selfSignedMessageFor,
  serializeDocument,
} from '@/vendor/identity'
import type {
  ProfileExport,
  ProfileFields,
  ProfilePresentation,
  ProfileTree,
} from '@/vendor/identity'

const CHAIN_ID = 31337
/** Where the local deploy puts IdentityRegistry on a fresh Hardhat node. */
const REGISTRY = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
const OTHER_REGISTRY = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'

const FIELDS: ProfileFields = {
  name: 'Ada Lovelace',
  title: 'Analyst',
  skills: ['Solidity', 'TypeScript'],
  rate: { currency: 'USDT', rateHourCents: 12500 },
  city: 'London',
}

interface IAnchored {
  tree: ProfileTree
  presentation: ProfilePresentation
  exportDocument: ProfileExport
  version: number
}

interface IFailure {
  status: number | undefined
  data: {
    name?: string
    message?: string
    errors?: Record<string, unknown>[]
  }
}

/**
 * ID-05: the hosted publish, read and withdraw API, against IdentityRegistry's
 * state machine in memory (IdentityRegistryFake). The same cases run against
 * the real contract on a Hardhat node in user-controller.identity.node.test.
 */
@suite()
export class UserControllerIdentityTest extends BaseControllerTest {
  private registry: IdentityRegistryFake
  private savedIdentity: IConfigParameters['identity']
  private savedCreate: IdentityChainFactory['create']

  private get userRepository(): UserRepository {
    return this.container.get('UserRepository')
  }

  private get chainFactory(): IdentityChainFactory {
    return this.container.get('IdentityChainFactory')
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

    this.registry = new IdentityRegistryFake(REGISTRY, CHAIN_ID)
    this.savedCreate = this.chainFactory.create
    this.chainFactory.create = () => this.registry
  }

  @timeout(10000)
  async after() {
    this.chainFactory.create = this.savedCreate
    Object.assign(this.parameters.identity, this.savedIdentity)
    await super.after()
  }

  @test()
  async publish_hostsTheCurrentPresentation_andAnyoneReadsIt() {
    const user = await this.userFixture.createUser()
    const anchored = this.anchor(user)

    const published = await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(anchored),
      throwOnError: true,
    })

    expect(published.status).to.equal(200)
    expect(published.data.custody).to.equal('hosted')
    expect(published.data.version).to.equal(1)
    expect(published.data.subject).to.equal(
      `did:pkh:eip155:${CHAIN_ID}:${user.address}`,
    )
    expect(published.data.status).to.deep.equal({
      result: 'Current',
      subjectDeactivated: false,
      checkedAtBlock: await this.registry.blockNumber(),
      finalized: true,
      unavailable: null,
    })

    const read = await this.readIdentity(user.address)

    expect(
      serializeDocument(read.presentation as ProfilePresentation),
    ).to.equal(serializeDocument(anchored.presentation))
    expect(read.status.result).to.equal('Current')
    expect(
      read.history?.map(({ kind, version }) => ({ kind, version })),
    ).to.deep.equal([{ kind: 'PUBLISHED', version: 1 }])
    expect(read.history?.[0].commitment).to.equal(
      anchored.presentation.commitment,
    )
  }

  /** SC-A01 at the API: nobody hosts another account's presentation. */
  @test()
  async publish_refusesAPresentationWhoseSubjectIsAnotherAccount() {
    const holder = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const anchored = this.anchor(holder)

    const failure = await this.publishFails(other, this.body(anchored))

    expect(failure.status).to.equal(403)
    expect(await this.readIdentityStatus(holder.address)).to.equal(404)
    expect(await this.readIdentityStatus(other.address)).to.equal(404)
  }

  @test()
  async publish_refusesATamperedValueAsInvalidProof() {
    const user = await this.userFixture.createUser()
    const anchored = this.anchor(user)
    const tampered = JSON.parse(
      serializeDocument(anchored.presentation),
    ) as ProfilePresentation
    const name = tampered.disclosures.find(({ pointer }) => pointer === '/name')

    if (!name) {
      throw new Error('The name is disclosed')
    }

    name.value = 'Ada Byron'

    const failure = await this.publishFails(
      user,
      this.body({ ...anchored, presentation: tampered }),
    )

    expect(failure.status).to.equal(422)
    expect(failure.data.errors).to.deep.equal([{ reason: 'InvalidProof' }])
    expect(await this.readIdentityStatus(user.address)).to.equal(404)
  }

  /**
   * The documented rule: the hosted copy is the current profile, so a
   * version the chain holds but has superseded is refused, not stored.
   */
  @test()
  async publish_refusesASupersededVersion() {
    const user = await this.userFixture.createUser()
    const first = this.anchor(user)
    const second = this.anchor(user, { ...FIELDS, title: 'Mathematician' })

    expect(second.version).to.equal(2)

    const failure = await this.publishFails(user, this.body(first))

    expect(failure.status).to.equal(409)
    expect(failure.data.errors).to.deep.equal([
      { result: 'Superseded', subjectDeactivated: false },
    ])
    expect(await this.readIdentityStatus(user.address)).to.equal(404)

    const published = await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(second),
      throwOnError: true,
    })

    expect(published.data.version).to.equal(2)
  }

  @test()
  async publish_refusesAVersionTheChainDoesNotHold() {
    const user = await this.userFixture.createUser()
    const tree = buildProfileTree({
      subject: evmSubject(user.address, CHAIN_ID),
      fields: FIELDS,
    })
    const unpublished = createAnchoredPresentation(tree, {
      disclose: ['name'],
      anchor: { chainId: CHAIN_ID, registry: REGISTRY, version: 1 },
    })

    const failure = await this.publishFails(user, {
      presentation: this.json(unpublished),
      export: this.json(createProfileExport(tree)),
    })

    expect(failure.status).to.equal(409)
    expect(failure.data.errors).to.deep.equal([
      { result: 'Unpublished', subjectDeactivated: false },
    ])
  }

  /**
   * After a withdrawal on chain the hosted copy reads as withdrawn - never
   * as current - and an old version of a withdrawn profile says so beside
   * "superseded", so no client can render it as merely out of date.
   */
  @test()
  async read_afterAChainWithdrawal_reportsDeactivatedNeverCurrent() {
    const user = await this.userFixture.createUser()
    const anchored = this.anchor(user)

    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(anchored),
      throwOnError: true,
    })

    this.registry.deactivate(user.address)

    const read = await this.readIdentity(user.address)

    expect(read.status.result).to.equal('Deactivated')
    expect(read.status.subjectDeactivated).to.equal(true)
    expect(read.history?.map(({ kind }) => kind)).to.deep.equal([
      'PUBLISHED',
      'DEACTIVATED',
    ])

    const republished = await this.publishFails(user, this.body(anchored))

    expect(republished.status).to.equal(409)
    expect(republished.data.errors).to.deep.equal([
      { result: 'Deactivated', subjectDeactivated: true },
    ])

    // v2 published and then withdrawn: the hosted v1 is superseded, and
    // the whole record is withdrawn.
    this.anchor(user, { ...FIELDS, title: 'Countess' })
    this.registry.deactivate(user.address)

    const later = await this.readIdentity(user.address)

    expect(later.status.result).to.equal('Superseded')
    expect(later.status.subjectDeactivated).to.equal(true)
  }

  /**
   * IdentityRegistry keys records by a 20-byte EVM address: a Solana or TON
   * account is refused by name, whatever it sends, and told that its
   * self-signed export is untouched.
   */
  @test()
  async publish_refusesSolanaAndTonAccountsByName() {
    const evmHolder = await this.userFixture.createUser()
    const anchored = this.anchor(evmHolder)
    const solana = await this.userWithAddress(
      bs58.encode(sign.keyPair().publicKey),
    )
    const ton = await this.userWithAddress(
      new Address(0, randomBytes(32)).toRawString(),
    )

    for (const [user, chain] of [
      [solana, 'Solana'],
      [ton, 'TON'],
    ] as const) {
      const failure = await this.publishFails(user, this.body(anchored))

      expect(failure.status, chain).to.equal(422)
      expect(failure.data.errors).to.deep.equal([
        { reason: 'UnsupportedSubjectScheme' },
      ])
      expect(failure.data.message).to.contain(`a ${chain} account`)
      expect(failure.data.message).to.contain('did:pkh:eip155')
      expect(failure.data.message).to.contain('self-signed export')
    }
  }

  /**
   * DELETE removes the hosted copy and the held export, and says in its
   * answer that the chain still holds every version (SC-A07).
   */
  @test()
  async remove_takesDownTheHostedCopyOnly() {
    const user = await this.userFixture.createUser()
    const anchored = this.anchor(user)

    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(anchored),
      throwOnError: true,
    })

    const removed = await userControllerRemoveIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      throwOnError: true,
    })

    expect(removed.data).to.include({
      removed: true,
      exportRemoved: true,
      chainUnchanged: true,
    })
    expect(removed.data.message).to.contain('IdentityRegistry still holds')
    expect(await this.readIdentityStatus(user.address)).to.equal(404)
    expect(await this.exportStatus(user)).to.equal(404)

    // The chain still reads the version the hosted copy was.
    expect(
      await this.registry.checkPresentation(
        {
          registry: REGISTRY,
          subject: user.address,
          version: anchored.version,
          commitment: anchored.presentation.commitment as string,
          schemaId: 1,
        },
        await this.registry.blockNumber(),
      ),
    ).to.deep.equal({ result: 'Current', subjectDeactivated: false })

    const again = await userControllerRemoveIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      throwOnError: true,
    })

    expect(again.data).to.include({ removed: false, exportRemoved: false })
  }

  /** The identity columns are in no serialization group, whoever reads. */
  @test()
  async identityColumns_neverAppearInTheProfileSearchOrTheHoldersRecord() {
    const user = await this.userFixture.createUser()
    const searcher = await this.userFixture.createUser()
    const anchored = this.anchor(user)

    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(anchored),
      throwOnError: true,
    })

    const commitment = anchored.presentation.commitment as string
    const salt = anchored.exportDocument.fields[0].salt
    const responses = [
      (
        await userControllerRead({
          client: this.apiClient(),
          path: { address: user.address as never },
          throwOnError: true,
        })
      ).data,
      (
        await userControllerRead({
          client: this.apiClient(),
          headers: this.auth(user),
          path: { address: user.address as never },
          throwOnError: true,
        })
      ).data,
      (
        await userControllerSearch({
          client: this.apiClient(),
          headers: this.auth(searcher),
          body: {
            filter: { id: user.id },
            sort: { createdAt: 'ASC' },
            page: 0,
          },
          throwOnError: true,
        })
      ).data,
      (
        await authControllerStatus({
          client: this.apiClient(),
          headers: this.auth(user),
          throwOnError: true,
        })
      ).data,
    ]

    expect((responses[2] as unknown as [unknown[], number])[0]).to.have.length(
      1,
    )

    for (const data of responses) {
      const text = JSON.stringify(data)

      expect(text).to.not.contain('identity')
      expect(text).to.not.contain(commitment)
      expect(text).to.not.contain(salt)
    }
  }

  /**
   * Hosted custody, the default, keeps the private export with the
   * presentation and gives it back to its holder alone; holder custody keeps
   * only the presentation. Either way the export must be the presentation's
   * own tree.
   */
  @test()
  async custody_hostedKeepsTheExportForItsHolder_holderKeepsNone() {
    const user = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const anchored = this.anchor(user)

    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(anchored),
      throwOnError: true,
    })

    const held = await userControllerIdentityExport({
      client: this.apiClient(),
      headers: this.auth(user),
      throwOnError: true,
    })

    expect(serializeDocument(held.data as unknown as ProfileExport)).to.equal(
      serializeDocument(anchored.exportDocument),
    )
    expect(await this.exportStatus(other)).to.equal(404)

    const second = this.anchor(user, { ...FIELDS, city: 'Paris' })
    const holderKept = await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: { presentation: this.json(second.presentation), custody: 'holder' },
      throwOnError: true,
    })

    expect(holderKept.data.custody).to.equal('holder')
    expect(holderKept.data.version).to.equal(2)
    // The export held for v1 went with v1: nothing stale is kept.
    expect(await this.exportStatus(user)).to.equal(404)
  }

  @test()
  async custody_refusesAMissingForeignOrMalformedExport() {
    const user = await this.userFixture.createUser()
    const anchored = this.anchor(user)
    const foreign = createProfileExport(
      buildProfileTree({
        subject: evmSubject(user.address, CHAIN_ID),
        fields: FIELDS,
      }),
    )
    const cases: [IdentityPublishDto, string][] = [
      [{ presentation: this.json(anchored.presentation) }, 'ExportRequired'],
      [
        {
          presentation: this.json(anchored.presentation),
          custody: 'holder',
          export: this.json(anchored.exportDocument),
        },
        'ExportNotExpected',
      ],
      [
        {
          presentation: this.json(anchored.presentation),
          export: this.json(foreign),
        },
        'ExportMismatch',
      ],
      [
        {
          presentation: this.json(anchored.presentation),
          export: { ...this.json(anchored.exportDocument), fillers: [] },
        },
        'InvalidExport',
      ],
    ]

    for (const [body, reason] of cases) {
      const failure = await this.publishFails(user, body)

      expect(failure.status, reason).to.equal(422)
      expect(failure.data.errors, reason).to.deep.equal([{ reason }])
    }

    expect(await this.readIdentityStatus(user.address)).to.equal(404)
  }

  @test()
  async publish_refusesAnotherRegistryAndSelfSignedPresentations() {
    const wallet = Wallet.createRandom()
    const user = await this.userWithAddress(wallet.address)
    const tree = buildProfileTree({
      subject: evmSubject(user.address, CHAIN_ID),
      fields: FIELDS,
    })
    const elsewhere = createAnchoredPresentation(tree, {
      disclose: ['name'],
      anchor: { chainId: CHAIN_ID, registry: OTHER_REGISTRY, version: 1 },
    })
    const selfSigned = createSelfSignedPresentation(tree, {
      disclose: ['name'],
      signature: await wallet.signMessage(selfSignedMessageFor(tree)),
    })
    const exportDocument = this.json(createProfileExport(tree))

    for (const [presentation, reason] of [
      [elsewhere, 'WrongRegistry'],
      [selfSigned, 'NotAnchored'],
    ] as const) {
      const failure = await this.publishFails(user, {
        presentation: this.json(presentation),
        export: exportDocument,
      })

      expect(failure.status, reason).to.equal(422)
      expect(failure.data.errors, reason).to.deep.equal([{ reason }])
    }
  }

  /**
   * A chain that cannot be read is a 503 naming why - never a 422 a client
   * could show as a failed proof - and a read still returns the hosted copy,
   * with the chain's answer marked unavailable.
   */
  @test()
  async chainOutage_isUnavailable_neverInvalid() {
    const user = await this.userFixture.createUser()
    const anchored = this.anchor(user)

    this.registry.down = true
    let failure = await this.publishFails(user, this.body(anchored))
    expect(failure.status).to.equal(503)
    expect(failure.data.errors).to.deep.equal([{ reason: 'RpcUnavailable' }])

    this.registry.down = false
    this.registry.reportedChainId = 1
    failure = await this.publishFails(user, this.body(anchored))
    expect(failure.status).to.equal(503)
    expect(failure.data.errors).to.deep.equal([{ reason: 'WrongChain' }])

    this.registry.reportedChainId = CHAIN_ID
    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(anchored),
      throwOnError: true,
    })

    this.registry.down = true
    const read = await this.readIdentity(user.address)

    expect(read.status).to.deep.equal({
      result: null,
      subjectDeactivated: null,
      checkedAtBlock: null,
      finalized: false,
      unavailable: 'RpcUnavailable',
    })
    expect(read.history).to.equal(null)
    expect(
      serializeDocument(read.presentation as ProfilePresentation),
    ).to.equal(serializeDocument(anchored.presentation))

    this.registry.down = false
    this.parameters.identity.rpcUrl = ''
    failure = await this.publishFails(user, this.body(anchored))
    expect(failure.status).to.equal(503)
    expect(failure.data.errors).to.deep.equal([{ reason: 'NotConfigured' }])
    expect((await this.readIdentity(user.address)).status.unavailable).to.equal(
      'NotConfigured',
    )
  }

  /** A presentation newer than the finalized block is current, not final. */
  @test()
  async status_isFinalOnlyWhenTheFinalizedBlockAgrees() {
    const user = await this.userFixture.createUser()

    this.registry.finalizedLag = 1

    const published = await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(this.anchor(user)),
      throwOnError: true,
    })

    expect(published.data.status.result).to.equal('Current')
    expect(published.data.status.finalized).to.equal(false)

    this.registry.finalizedLag = 0

    expect((await this.readIdentity(user.address)).status.finalized).to.equal(
      true,
    )
  }

  /** ID-13 carries over: a hidden profile's identity is its holder's alone. */
  @test()
  async read_hiddenProfilesIdentityIsFoundOnlyByItsHolder() {
    const user = await this.userFixture.createUser()
    const stranger = await this.userFixture.createUser()

    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(this.anchor(user)),
      throwOnError: true,
    })

    user.visible = false
    await runPromise(this.userRepository.saveSingle(user))

    expect(await this.readIdentityStatus(user.address)).to.equal(404)
    expect(await this.readIdentityStatus(user.address, stranger)).to.equal(404)
    expect(await this.readIdentityStatus(user.address, user)).to.equal(200)
  }

  /**
   * Only the identity routes write the hosted copy: a profile edit, or a
   * save of a User object that was loaded or created before the publish,
   * leaves it exactly as it was.
   */
  @test()
  async userSaves_neverTouchTheHostedIdentity() {
    const user = await this.userFixture.createUser()
    const anchored = this.anchor(user)

    await userControllerPublishIdentity({
      client: this.apiClient(),
      headers: this.auth(user),
      body: this.body(anchored),
      throwOnError: true,
    })

    await userControllerEdit({
      client: this.apiClient(),
      headers: this.auth(user),
      body: { title: 'Countess of Lovelace' },
      throwOnError: true,
    })
    // `user` is the object TypeORM inserted, its identity columns set null.
    user.city = 'Ockham'
    await runPromise(this.userRepository.saveSingle(user))

    const read = await this.readIdentity(user.address)

    expect(
      serializeDocument(read.presentation as ProfilePresentation),
    ).to.equal(serializeDocument(anchored.presentation))
    expect(await this.exportStatus(user)).to.equal(200)
  }

  /** Builds a tree for `user`, publishes its commitment, and presents it. */
  private anchor(user: User, fields: ProfileFields = FIELDS): IAnchored {
    const tree = buildProfileTree({
      subject: evmSubject(user.address, CHAIN_ID),
      fields,
    })
    const version = this.registry.versionCount(user.address) + 1
    const presentation = createAnchoredPresentation(tree, {
      disclose: ['name', 'skills', 'rate'],
      anchor: { chainId: CHAIN_ID, registry: REGISTRY, version },
    })

    expect(
      this.registry.publish(user.address, presentation.commitment as string),
    ).to.equal(version)

    return {
      tree,
      presentation,
      exportDocument: createProfileExport(tree),
      version,
    }
  }

  private body(anchored: IAnchored): IdentityPublishDto {
    return {
      presentation: this.json(anchored.presentation),
      export: this.json(anchored.exportDocument),
    }
  }

  private json(document: object): Record<string, unknown> {
    return structuredClone(document) as Record<string, unknown>
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  private async userWithAddress(address: string): Promise<User> {
    const user = await this.userFixture.createUser()

    user.address = address

    return runPromise(this.userRepository.saveSingle(user))
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

  private async readIdentity(address: string) {
    const res = await userControllerReadIdentity({
      client: this.apiClient(),
      path: { address: address as never },
      throwOnError: true,
    })

    expect(res.status).to.equal(200)

    return res.data
  }

  private async readIdentityStatus(
    address: string,
    caller?: User,
  ): Promise<number | undefined> {
    try {
      const res = await userControllerReadIdentity({
        client: this.apiClient(),
        ...(caller ? { headers: this.auth(caller) } : {}),
        path: { address: address as never },
        throwOnError: true,
      })

      return res.status
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) throw error

      return error.response?.status
    }
  }

  private async exportStatus(user: User): Promise<number | undefined> {
    try {
      const res = await userControllerIdentityExport({
        client: this.apiClient(),
        headers: this.auth(user),
        throwOnError: true,
      })

      return res.status
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) throw error

      return error.response?.status
    }
  }
}

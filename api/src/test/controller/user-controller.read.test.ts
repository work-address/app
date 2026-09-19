import { expect } from 'chai'
import axios from 'axios'
import bs58 from 'bs58'
import { randomBytes } from 'crypto'
import * as web3 from 'web3'
import { Address } from '@ton/core'
import { faker } from '@faker-js/faker'
import { sign } from 'tweetnacl'
import { suite, test } from '@testdeck/mocha'

import {
  authControllerStatus,
  userControllerEdit,
  userControllerRead,
} from '@app/api-client'
import type { UserEdit } from '@app/api-client'

import { User } from '@/entity/user'
import { UserRepository } from '@/repository/user-repository'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { runPromise } from '@/service/effect-bridge'

/**
 * Everything the anonymous profile may carry (PRODUCT.md 4.7): the address,
 * and the name, title, company, bio, rate, skills, location and social links
 * the profile page shows. Pinned exactly, so widening the public projection
 * is a decision somebody has to change this list for.
 */
const PUBLIC_PROFILE_KEYS = [
  'address',
  'name',
  'title',
  'company',
  'bio',
  'rate',
  'skills',
  'facebook',
  'linkedIn',
  'twitter',
  'instagram',
  'youtube',
  'telegram',
  'tz',
  'city',
  'country',
]

/** Held on the account, never shown on its profile - whoever is asking. */
const PRIVATE_KEYS = [
  'email',
  'phone',
  'whatsapp',
  'roles',
  'premium',
  'password',
  'deletedAt',
]

@suite()
export class UserControllerReadTest extends BaseControllerTest {
  private get userRepository(): UserRepository {
    return this.container.get<UserRepository>('UserRepository')
  }

  /** An account with every private field filled, so an absence means something. */
  private async createUserWithPrivateDetails(): Promise<User> {
    const user = await this.userFixture.createUser()

    user.phone = this.faker.phone()
    user.whatsapp = this.faker.phone()
    user.premium = true
    user.name = faker.person.fullName()
    user.title = faker.person.jobTitle()

    return runPromise(this.userRepository.saveSingle(user))
  }

  private expectPublicProjectionOnly(data: unknown): void {
    expect(Object.keys(data as object)).to.have.members(PUBLIC_PROFILE_KEYS)
    for (const key of PRIVATE_KEYS) {
      expect(data, key).to.not.have.property(key)
    }
  }

  private async readStatus(user: User) {
    const res = await authControllerStatus({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    return res.data as unknown as { premium?: boolean | null }
  }

  @test()
  async read_returnsProfileForExistingAddress() {
    const user = await this.createUserWithPrivateDetails()
    const client = this.apiClient()

    const res = await userControllerRead({
      client,
      path: { address: user.address as never },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data!.address).to.be.eq(user.address)
    expect(res.data!.name).to.be.eq(user.name)
    expect(res.data!.title).to.be.eq(user.title)
    expect(res.data!.company).to.be.eq(user.company)
    expect(res.data!.bio).to.be.eq(user.bio)
    expect(Number(res.data!.rate)).to.be.eq(Number(user.rate))
    expect(res.data!.skills).to.be.eq(user.skills)
    expect(res.data!.facebook).to.be.eq(user.facebook)
    expect(res.data!.linkedIn).to.be.eq(user.linkedIn)
    expect(res.data!.twitter).to.be.eq(user.twitter)
    expect(res.data!.instagram).to.be.eq(user.instagram)
    expect(res.data!.youtube).to.be.eq(user.youtube)
    expect(res.data!.telegram).to.be.eq(user.telegram)
    expect(res.data!.tz).to.be.eq(user.tz)
    expect(res.data!.city).to.be.eq(user.city)
    expect(res.data!.country).to.be.eq(user.country)
    // The anonymous read used to hand out the contact details and roles
    // (G13). The account holds them; the profile does not show them.
    expect(user.email).to.be.a('string').and.not.be.empty
    expect(user.phone).to.be.a('string').and.not.be.empty
    expect(res.data).to.not.have.property('email')
    expect(res.data).to.not.have.property('phone')
    expect(res.data).to.not.have.property('roles')
    // Not on the page, so not in the projection: the row id and timestamps
    // identify the account, not the person.
    expect(res.data).to.not.have.property('id')
    expect(res.data).to.not.have.property('createdAt')
    expect(res.data).to.not.have.property('updatedAt')
    this.expectPublicProjectionOnly(res.data)
  }

  @test()
  async read_signedInCallerGetsTheSamePublicProjection() {
    const owner = await this.createUserWithPrivateDetails()
    const stranger = await this.userFixture.createUser()

    // A token changes nothing: the read is the profile, not the account,
    // whether a stranger or the holder is asking.
    for (const caller of [stranger, owner]) {
      const res = await userControllerRead({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(caller).accessToken,
        },
        path: { address: owner.address as never },
        throwOnError: true,
      })

      expect(res.status).to.be.equal(200)
      expect(res.data!.address).to.be.eq(owner.address)
      expect(res.data!.name).to.be.eq(owner.name)
      this.expectPublicProjectionOnly(res.data)
    }
  }

  @test()
  async read_notFoundForUnknownAddress() {
    const client = this.apiClient()
    const ghost = web3.eth.accounts.create()

    let error: unknown

    try {
      await userControllerRead({
        client,
        path: { address: ghost.address as never },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(404)
  }

  @test()
  async read_returnsExtendedPublicProfileFields() {
    const user = await this.userFixture.createUser()
    const client = this.apiClient()

    const data = {
      title: faker.person.jobTitle(),
      company: faker.company.name(),
      bio: faker.lorem.sentence(),
      skills: faker.lorem.words(3),
      facebook: faker.internet.url(),
      linkedIn: faker.internet.url(),
      twitter: `@${faker.internet.username().toLowerCase()}`,
      instagram: `@${faker.internet.username().toLowerCase()}`,
      youtube: faker.internet.url(),
      telegram: `@${faker.internet.username().toLowerCase()}`,
      whatsapp: this.faker.phone(),
      tz: 'Europe/Kyiv',
      city: faker.location.city(),
      country: faker.location.country(),
    }

    await userControllerEdit({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: data as unknown as UserEdit,
      throwOnError: true,
    })

    const readRes = await userControllerRead({
      client,
      path: { address: user.address as never },
      throwOnError: true,
    })
    const profile = readRes.data as unknown as {
      title: string
      company: string
      bio: string
      skills: string
      facebook: string
      linkedIn: string
      twitter: string
      instagram: string
      youtube: string
      telegram: string
      tz: string
      city: string
      country: string
    }

    expect(readRes.status).to.be.equal(200)
    expect(profile.title).to.be.eq(data.title)
    expect(profile.company).to.be.eq(data.company)
    expect(profile.bio).to.be.eq(data.bio)
    expect(profile.skills).to.be.eq(data.skills)
    expect(profile.facebook).to.be.eq(data.facebook)
    expect(profile.linkedIn).to.be.eq(data.linkedIn)
    expect(profile.twitter).to.be.eq(data.twitter)
    expect(profile.instagram).to.be.eq(data.instagram)
    expect(profile.youtube).to.be.eq(data.youtube)
    expect(profile.telegram).to.be.eq(data.telegram)
    expect(profile.tz).to.be.eq(data.tz)
    expect(profile.city).to.be.eq(data.city)
    expect(profile.country).to.be.eq(data.country)
    expect(readRes.data).to.not.have.property('whatsapp')
  }

  @test()
  async read_hidesPremiumFlag_holderStillReadsIt() {
    const user = await this.userFixture.createUser()

    user.premium = true
    await runPromise(this.userRepository.saveSingle(user))

    const client = this.apiClient()
    const res = await userControllerRead({
      client,
      path: { address: user.address as never },
      throwOnError: true,
    })

    // Premium governs retention; it is not a credential to show visitors.
    expect(res.data).to.not.have.property('premium')
    // It moved to the holder's own record rather than disappearing.
    expect((await this.readStatus(user)).premium).to.be.eq(true)
  }

  @test()
  async read_premiumDefaultsFalse() {
    const user = await this.userFixture.createUser()
    const client = this.apiClient()

    const res = await userControllerRead({
      client,
      path: { address: user.address as never },
      throwOnError: true,
    })

    expect(res.data).to.not.have.property('premium')
    expect((await this.readStatus(user)).premium).to.be.eq(false)
  }

  @test()
  async edit_cannotSelfGrantPremium() {
    const user = await this.userFixture.createUser()
    const client = this.apiClient()

    await userControllerEdit({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: { premium: true } as unknown as UserEdit,
      throwOnError: true,
    })

    // Read back where the flag is visible - the holder's own record - and
    // from the row itself, so the check cannot pass on an absent key.
    expect((await this.readStatus(user)).premium).to.be.eq(false)
    const stored = await runPromise(
      this.userRepository.findByAddressPublicOrFail(user.address),
    )
    expect(stored.premium).to.be.eq(false)
  }

  /**
   * G17. The profile used to be found by LOWER() of both sides. Base58 is
   * case-sensitive, so /profile/<a Solana address> could open the profile
   * of a different account whose address differs only in case. Each address
   * now opens its own account, and a case variant with no account is a 404.
   */
  @test()
  async read_solanaAddressResolvesOnlyExactly() {
    const { address, caseVariant } = UserControllerReadTest.solanaPair()
    const holder = await this.userWithAddress(address)

    expect(await this.readStatusFor(caseVariant)).to.be.eq(404)

    const variantHolder = await this.userWithAddress(caseVariant)

    for (const user of [holder, variantHolder]) {
      const res = await userControllerRead({
        client: this.apiClient(),
        path: { address: user.address as never },
        throwOnError: true,
      })

      expect(res.data!.address).to.be.eq(user.address)
      expect(res.data!.name).to.be.eq(user.name)
    }
  }

  /**
   * The other chains keep resolving by their own rule: EVM in any case, TON
   * in either spelling - including a friendly spelling saved before
   * addresses were canonicalised on write.
   */
  @test()
  async read_evmAndTonResolveByTheirOwnRules() {
    const evm = await this.userFixture.createUser()
    const tonAccount = new Address(0, randomBytes(32))
    const ton = await this.userWithAddress(tonAccount.toRawString())
    const legacyAccount = new Address(0, randomBytes(32))
    const legacyFriendly = legacyAccount.toString({ bounceable: false })
    // Written past the managers, so the row holds the friendly spelling as
    // it did before canonicalise-on-write.
    const legacy = await this.userWithAddress(legacyFriendly)

    expect(legacy.address).to.be.eq(legacyFriendly)

    const cases: [string, User][] = [
      [evm.address.toLowerCase(), evm],
      [evm.address.toUpperCase().replace('0X', '0x'), evm],
      [tonAccount.toString({ bounceable: false }), ton],
      [tonAccount.toString({ bounceable: true }), ton],
      [legacyAccount.toRawString(), legacy],
    ]

    expect(evm.address).to.match(/^0x[\dA-Fa-f]{40}$/)

    for (const [lookup, user] of cases) {
      const res = await userControllerRead({
        client: this.apiClient(),
        path: { address: lookup as never },
        throwOnError: true,
      })

      expect(res.data!.name, lookup).to.be.eq(user.name)
    }
  }

  /**
   * ID-13. A hidden profile answers exactly as an address with no account
   * does - 404, whoever else is asking - while its holder still opens it. The
   * holder gets the same public projection anyone gets for a visible one.
   */
  @test()
  async read_hiddenProfileIsNotFoundToAnyoneButItsHolder() {
    const owner = await this.createUserWithPrivateDetails()
    const stranger = await this.userFixture.createUser()

    owner.visible = false
    await runPromise(this.userRepository.saveSingle(owner))

    expect(await this.readStatusFor(owner.address)).to.be.eq(404)
    expect(await this.readStatusFor(owner.address, stranger)).to.be.eq(404)

    let notFound: unknown

    try {
      await userControllerRead({
        client: this.apiClient(),
        path: { address: owner.address as never },
        throwOnError: true,
      })
    } catch (error: unknown) {
      notFound = error
    }

    if (!axios.isAxiosError(notFound)) throw notFound
    // The same body an unknown address gets, so a 404 says nothing about
    // whether an account is there.
    expect(notFound.response?.data).to.deep.eq({
      name: 'NotFoundError',
      message: 'User does not exist',
    })

    const res = await userControllerRead({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      path: { address: owner.address as never },
      throwOnError: true,
    })

    expect(res.status).to.be.eq(200)
    expect(res.data!.name).to.be.eq(owner.name)
    this.expectPublicProjectionOnly(res.data)
  }

  @test()
  async read_showingAHiddenProfileAgainMakesItPublic() {
    const owner = await this.userFixture.createUser()

    owner.visible = false
    await runPromise(this.userRepository.saveSingle(owner))
    expect(await this.readStatusFor(owner.address)).to.be.eq(404)

    await userControllerEdit({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: { visible: true },
      throwOnError: true,
    })

    expect(await this.readStatusFor(owner.address)).to.be.eq(200)
  }

  /**
   * The flag is the holder's alone: visitors never see it, even on a
   * visible profile, and the holder reads it on their own record.
   */
  @test()
  async read_visibilityIsOnTheHoldersRecordOnly() {
    const user = await this.userFixture.createUser()

    const res = await userControllerRead({
      client: this.apiClient(),
      path: { address: user.address as never },
      throwOnError: true,
    })

    expect(res.data).to.not.have.property('visible')

    const status = (await this.readStatus(user)) as { visible?: boolean }

    expect(status.visible).to.be.eq(true)
  }

  /**
   * A base58 Solana address with both lowercase and uppercase letters, and
   * the same string with one letter's case flipped.
   */
  private static solanaPair(): { address: string; caseVariant: string } {
    for (;;) {
      const address = bs58.encode(sign.keyPair().publicKey)
      const at = address.search(/[a-km-zA-HJ-NP-Z]/)

      if (at < 0 || !/[a-z]/.test(address) || !/[A-Z]/.test(address)) {
        continue
      }

      const letter = address[at]
      const flipped =
        letter === letter.toLowerCase()
          ? letter.toUpperCase()
          : letter.toLowerCase()

      if (!/[1-9A-HJ-NP-Za-km-z]/.test(flipped)) {
        continue
      }

      return {
        address,
        caseVariant: `${address.slice(0, at)}${flipped}${address.slice(at + 1)}`,
      }
    }
  }

  private async userWithAddress(address: string): Promise<User> {
    const user = await this.userFixture.createUser()

    user.address = address
    user.name = faker.person.fullName()

    return runPromise(this.userRepository.saveSingle(user))
  }

  private async readStatusFor(
    address: string,
    caller?: User,
  ): Promise<number | undefined> {
    try {
      const res = await userControllerRead({
        client: this.apiClient(),
        ...(caller
          ? {
              headers: {
                Authorization: this.authenticator.getTokens(caller).accessToken,
              },
            }
          : {}),
        path: { address: address as never },
        throwOnError: true,
      })

      return res.status
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) throw error

      return error.response?.status
    }
  }
}

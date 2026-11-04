import { expect } from 'chai'
import axios from 'axios'
import * as web3 from 'web3'
import { faker } from '@faker-js/faker'
import { suite, test } from '@testdeck/mocha'

import {
  authControllerStatus,
  userControllerEdit,
  userControllerRead,
} from '@app/api-client'
import type { UserEdit } from '@app/api-client'

import { UserRepository } from '@/repository/user-repository'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class UserControllerReadTest extends BaseControllerTest {
  @test()
  async read_cleansABioSavedBeforeBiosWereCleaned() {
    const user = await this.userFixture.createUser()
    const repository = this.container.get<UserRepository>('UserRepository')

    user.bio = '<p>Hi</p><img src=x onerror="alert(1)">'
    await runPromise(repository.saveSingle(user))

    const res = await userControllerRead({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      path: { id: user.id as never },
      throwOnError: true,
    })

    expect(res.data!.bio).to.be.eq('<p>Hi</p>')
  }

  @test()
  async read_returnsProfileById() {
    const user = await this.userFixture.createUser()
    const client = this.apiClient()

    const res = await userControllerRead({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      path: { id: user.id as never },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data!.id).to.be.eq(user.id)
    expect(res.data!.address).to.be.eq(user.address)
    expect(res.data!.email).to.be.eq(user.email)
    expect(res.data!.phone).to.be.eq(user.phone)
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
    expect(res.data!.createdAt).to.exist
    expect(new Date(res.data!.createdAt!).toISOString()).to.be.eq(
      user.createdAt.toISOString(),
    )
    expect(res.data!.updatedAt).to.exist
    expect(new Date(res.data!.updatedAt!).toISOString()).to.be.eq(
      user.updatedAt.toISOString(),
    )
    expect(res.data).to.not.have.property('password')
    expect(res.data).to.not.have.property('whatsapp')
    expect(res.data).to.not.have.property('deletedAt')
  }

  @test()
  async read_notFoundForUnknownId() {
    const client = this.apiClient()
    const reader = await this.userFixture.createUser()

    let error: unknown

    try {
      await userControllerRead({
        client,
        headers: {
          Authorization: this.authenticator.getTokens(reader).accessToken,
        },
        path: { id: faker.string.uuid() as never },
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
  async read_returnsExtendedProfileFields() {
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
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      path: { id: user.id as never },
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

  /** Anything readable anonymously can be scraped, and profiles hold emails. */
  @test()
  async read_refusesAnAnonymousReader() {
    const user = await this.userFixture.createUser()

    const res = await axios.get(`${this.url}/api/user/${user.id}`, {
      validateStatus: () => true,
    })

    expect(res.status).to.be.equal(401)
  }

  /** The address route let anyone test whether an email has an account. */
  @test()
  async read_hasNoAddressLookup() {
    const user = await this.userFixture.createGoogleUser()

    const res = await axios.get(
      `${this.url}/api/user/${user.address}/address`,
      {
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        validateStatus: () => true,
      },
    )

    expect(res.status).to.be.equal(404)
  }

  @test()
  async read_showsAnotherReaderEverythingFilledInButNotRolesOrPremium() {
    const user = await this.userFixture.createGoogleUser()
    const reader = await this.userFixture.createUser()
    const userRepository = this.container.get<UserRepository>('UserRepository')

    user.premium = true
    user.name = faker.person.fullName()
    user.connectedWallet = web3.eth.accounts.create().address
    await runPromise(userRepository.saveSingle(user))

    const res = await userControllerRead({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(reader).accessToken,
      },
      path: { id: user.id as never },
      throwOnError: true,
    })

    expect(res.data!.address).to.be.eq(user.address)
    expect(res.data!.name).to.be.eq(user.name)
    expect(res.data!.connectedWallet).to.be.eq(user.connectedWallet)
    expect(res.data!.payWallet).to.be.eq(user.connectedWallet)
    expect(res.data).to.not.have.property('roles')
    expect(res.data).to.not.have.property('premium')
    expect(res.data).to.not.have.property('googleSub')
    expect(res.data).to.not.have.property('contactEmail')
  }

  @test()
  async read_paysAWalletAccountAtItsOwnAddress() {
    const user = await this.userFixture.createUser()

    const res = await userControllerRead({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      path: { id: user.id as never },
      throwOnError: true,
    })

    expect(res.data!.payWallet).to.be.eq(user.address)
  }

  @test()
  async read_paysAGoogleAccountWithoutAWalletNowhere() {
    const user = await this.userFixture.createGoogleUser()

    const res = await userControllerRead({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      path: { id: user.id as never },
      throwOnError: true,
    })

    expect(res.data!.payWallet).to.be.null
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

    const status = await authControllerStatus({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    expect((status.data as unknown as { premium: boolean }).premium).to.be.eq(
      false,
    )
  }
}

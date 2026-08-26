import { expect } from 'chai'
import axios from 'axios'
import * as web3 from 'web3'
import { faker } from '@faker-js/faker'
import { suite, test } from '@testdeck/mocha'

import { userControllerEdit, userControllerRead } from '@app/api-client'
import type { UserEdit } from '@app/api-client'

import { UserRepository } from '@/repository/user-repository'
import { BaseControllerTest } from '@/test/controller/base-controller.test'

@suite()
export class UserControllerReadTest extends BaseControllerTest {
  @test()
  async read_returnsProfileForExistingAddress() {
    const user = await this.userFixture.createUser()
    const client = this.apiClient()

    const res = await userControllerRead({
      client,
      path: { address: user.address as never },
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
    expect(res.data!.roles).to.deep.eq(user.roles)
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
    expect(res.data).to.not.have.property('emailOrPhone')
    expect(res.data).to.not.have.property('whatsapp')
    expect(res.data).to.not.have.property('deletedAt')
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
  async read_exposesPremiumFlag() {
    const user = await this.userFixture.createUser()
    const userRepository = this.container.get<UserRepository>('UserRepository')

    user.premium = true
    await userRepository.saveSingle(user)

    const client = this.apiClient()
    const res = await userControllerRead({
      client,
      path: { address: user.address as never },
      throwOnError: true,
    })

    expect((res.data as unknown as { premium: boolean }).premium).to.be.eq(true)
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

    expect((res.data as unknown as { premium: boolean }).premium).to.be.eq(
      false,
    )
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

    const readRes = await userControllerRead({
      client,
      path: { address: user.address as never },
      throwOnError: true,
    })

    expect((readRes.data as unknown as { premium: boolean }).premium).to.be.eq(
      false,
    )
  }
}

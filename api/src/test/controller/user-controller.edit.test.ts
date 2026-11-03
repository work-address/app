import { expect } from 'chai'
import { faker } from '@faker-js/faker'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import { userControllerEdit } from '@app/api-client'
import type { UserEdit } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { UserRepository } from '@/repository/user-repository'
import { EUserRole } from '@/model/user'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class UserControllerEditTest extends BaseControllerTest {
  protected userRepository: UserRepository

  constructor() {
    super()

    this.userRepository = this.container.get('UserRepository')
  }

  @test()
  async edit_requiresAuthorization() {
    let error: unknown

    try {
      await userControllerEdit({
        client: this.apiClient(),
        body: {
          bio: 'x',
          tz: 'UTC',
          skills: 'y',
          rate: 1,
          phone: this.faker.phone(),
          roles: [EUserRole.ROLE_USER],
        } as unknown as UserEdit,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
  }

  @test()
  async edit() {
    const user = await this.userFixture.createUser()

    const data = {
      bio: faker.number.int(),
      title: faker.person.jobTitle(),
      company: faker.company.name(),
      roles: [EUserRole.ROLE_USER],
      tz: 'America/Los_Angeles',
      phone: this.faker.phone(),
      skills: faker.string.uuid(),
      rate: faker.number.int(50),
      facebook: faker.internet.url(),
      linkedIn: faker.internet.url(),
      twitter: `@${faker.internet.username().toLowerCase()}`,
      instagram: `@${faker.internet.username().toLowerCase()}`,
      youtube: faker.internet.url(),
      telegram: `@${faker.internet.username().toLowerCase()}`,
      city: faker.location.city(),
      country: faker.location.country(),
    }

    const client = this.apiClient()
    const res = await userControllerEdit({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: data as unknown as UserEdit,
      throwOnError: true,
    })
    const updated = await runPromise(
      this.userRepository.findByEmailPhoneOrFail(data.phone),
    )

    expect(res.status).to.be.equal(204)
    this.expectEmptyResponseBody(res.data)

    expect(updated.bio).to.be.equal(data.bio.toString())
    expect(updated.title).to.be.equal(data.title)
    expect(updated.company).to.be.equal(data.company)
    expect(updated.roles).to.be.deep.equal([EUserRole.ROLE_USER])
    expect(updated.tz).to.be.eq(data.tz)
    expect(parseFloat(updated.rate as unknown as string)).to.be.eq(data.rate)
    expect(updated.skills).to.be.eq(data.skills)
    expect(updated.phone).to.be.eq(data.phone)
    expect(updated.facebook).to.be.eq(data.facebook)
    expect(updated.linkedIn).to.be.eq(data.linkedIn)
    expect(updated.twitter).to.be.eq(data.twitter)
    expect(updated.instagram).to.be.eq(data.instagram)
    expect(updated.youtube).to.be.eq(data.youtube)
    expect(updated.telegram).to.be.eq(data.telegram)
    expect(updated.city).to.be.eq(data.city)
    expect(updated.country).to.be.eq(data.country)
  }

  @test()
  async validationErrors() {
    const user = await this.userFixture.createUser()

    const data = {
      email: 'not-a-valid-email',
    }

    let error: unknown

    try {
      await userControllerEdit({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: data as unknown as UserEdit,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data.errors).to.have.length(1)
  }

  @test()
  async changeEmailUser() {
    const user = await this.userFixture.createUser()

    const data = Object.assign({}, user, {
      email: faker.internet.email(),
    })

    const client = this.apiClient()
    const res = await userControllerEdit({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: data as unknown as UserEdit,
      throwOnError: true,
    })

    expect(res.status).to.be.equal(204)
    this.expectEmptyResponseBody(res.data)
  }

  @test()
  async clearEmail() {
    const user = await this.userFixture.createUser()
    const response = await userControllerEdit({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: { email: null },
      throwOnError: true,
    })
    const updated = await runPromise(
      this.userRepository.findOneByIdOrFail(user.id),
    )
    expect(response.status).to.equal(204)
    expect(updated.email).to.equal(null)
  }

  @test()
  async omittedEmailIsPreserved() {
    const user = await this.userFixture.createUser()
    await userControllerEdit({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: { title: 'Updated title' },
      throwOnError: true,
    })
    const updated = await runPromise(
      this.userRepository.findOneByIdOrFail(user.id),
    )
    expect(updated.email).to.equal(user.email)
    expect(updated.title).to.equal('Updated title')
  }

  /** Unconfirmed, so one account must not be able to block another's. */
  @test()
  async emailAndPhoneCanBeShared() {
    const first = await this.userFixture.createUser()
    const second = await this.userFixture.createUser()
    const client = this.apiClient()
    const shared = { email: this.faker.email(), phone: this.faker.phone() }

    for (const user of [first, second]) {
      await userControllerEdit({
        client,
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: shared as never,
        throwOnError: true,
      })
    }

    const updated = await runPromise(
      this.userRepository.findOneByIdOrFail(second.id),
    )

    expect(updated.email).to.be.equal(shared.email)
    expect(updated.phone).to.be.equal(shared.phone)
  }

  /** Mail for a Google account goes to the address Google proved. */
  @test()
  async aGoogleAccountCannotSetAnEmail() {
    const user = await this.userFixture.createGoogleUser()

    await userControllerEdit({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: { email: this.faker.email() } as never,
      throwOnError: true,
    })

    const updated = await runPromise(
      this.userRepository.findOneByIdOrFail(user.id),
    )

    expect(updated.email).to.be.null
    expect(updated.contactEmail).to.be.equal(user.address)
  }

  /** Setting these needs a signature, which the profile form must not skip. */
  @test()
  async theProfileFormCannotSetIdentity() {
    const user = await this.userFixture.createGoogleUser()

    await userControllerEdit({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        address: this.faker.email(),
        googleSub: 'someone-else',
        connectedWallet: '0x52908400098527886E0F7030069857D2E4169EE7',
      } as never,
      throwOnError: true,
    })

    const updated = await runPromise(
      this.userRepository.findOneByIdOrFail(user.id),
    )

    expect(updated.address).to.be.equal(user.address)
    expect(updated.googleSub).to.be.equal(user.googleSub)
    expect(updated.connectedWallet).to.be.null
  }
}

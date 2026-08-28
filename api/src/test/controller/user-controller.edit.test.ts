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
  async duplicatePhoneException() {
    const phoneA = this.faker.phone()
    const phoneB = this.faker.phone()
    const userA = await this.userFixture.createUserWithPhone(phoneA)
    const userB = await this.userFixture.createUserWithPhone(phoneB)

    userB.phone = userA.phone

    let error: unknown

    try {
      await userControllerEdit({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(userB).accessToken,
        },
        body: userB as unknown as UserEdit,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data.name).to.be.equal('BadRequestError')
    expect(
      error.response?.data.errors?.[0].constraints.PhoneConstraint,
    ).to.be.equal('Phone number already exists.')
  }

  @test()
  async duplicateEmailException() {
    const emailA = faker.internet.email()
    const emailB = faker.internet.email()
    const userA = await this.userFixture.createWithEmailAndPassword(emailA)
    const userB = await this.userFixture.createWithEmailAndPassword(emailB)

    userB.email = userA.email

    let error: unknown

    try {
      await userControllerEdit({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(userB).accessToken,
        },
        body: userB as unknown as UserEdit,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data.name).to.be.equal('BadRequestError')
    expect(
      error.response?.data.errors?.[0].constraints.EmailConstraint,
    ).to.be.equal('Email address is already taken')
  }
}

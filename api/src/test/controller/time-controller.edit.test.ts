import { expect } from 'chai'
import faker from 'faker'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import { timeControllerEdit } from '@app/api-client'
import type { TimeEdit } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { TimeRepository } from '@/repository/time-repository'
import { EProjectState } from '@/model/project'

@suite()
export class TimeControllerEditTest extends BaseControllerTest {
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.timeRepository = this.container.get('TimeRepository')
  }

  @test()
  async edit_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerEdit({
        client: this.apiClient(),
        path: { id: faker.datatype.uuid() as never },
        body: {
          note: faker.datatype.uuid(),
          isPaid: true,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('AuthenticationException')
  }

  @test()
  async edit() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const data = {
      note: faker.datatype.uuid(),
      isPaid: true,
    }

    const client = this.apiClient()
    const res = await timeControllerEdit({
      client,
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: data,
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)

    expect(updated).to.not.eq(undefined)
    expect(updated!.note).to.be.eq(data.note)
    expect(updated!.isPaid).to.be.eq(data.isPaid)
    expect(updated!.keyboardKeys).to.be.eq(time.keyboardKeys)
    expect(updated!.minutesActive).to.be.eq(time.minutesActive)
    expect(updated!.mouseKeys).to.be.eq(time.mouseKeys)
    expect(updated!.mouseDistance).to.be.eq(time.mouseDistance)
    expect(updated!.fromAt.toISOString()).to.be.eq(time.fromAt.toISOString())
    expect(updated!.toAt.toISOString()).to.be.eq(time.toAt.toISOString())
  }

  @test()
  async edit_setsIsPaidToFalse() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    time.isPaid = true
    await this.timeRepository.saveSingle(time)

    await timeControllerEdit({
      client: this.apiClient(),
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        note: time.note ?? undefined,
        isPaid: false,
      },
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(updated!.isPaid).to.be.false
  }

  @test()
  async edit_noteOnlyLeavesIsPaidUnchanged() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    time.isPaid = true
    await this.timeRepository.saveSingle(time)

    const note = faker.datatype.uuid()

    await timeControllerEdit({
      client: this.apiClient(),
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: { note },
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(updated!.note).to.be.eq(note)
    expect(updated!.isPaid).to.be.true
  }

  @test()
  async edit_isPaidDefaultsToFalseOnCreate() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const saved = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(saved!.isPaid).to.be.false
  }

  @test()
  async edit_deniedForNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const data = {
      note: faker.datatype.uuid(),
      isPaid: true,
    }

    let error: unknown

    try {
      await timeControllerEdit({
        client: this.apiClient(),
        path: { id: time.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        body: data,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('UserAccessException')
    expect(error.response?.data.message).to.be.equal(
      "Access error: The data can't be accessed by your user",
    )

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(unchanged!.note).to.not.eq(data.note)
    expect(unchanged!.isPaid).to.not.eq(data.isPaid)
  }

  @test()
  async edit_unknownTime_notFound() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerEdit({
        client: this.apiClient(),
        path: { id: faker.datatype.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          note: faker.datatype.uuid(),
          isPaid: true,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(404)
    expect(error.response?.data.name).to.be.equal('NotFoundError')
    expect(error.response?.data.message).to.be.equal('Time does not exist')
  }

  @test()
  async edit_validationErrors() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    let error: unknown

    try {
      await timeControllerEdit({
        client: this.apiClient(),
        path: { id: time.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          isPaid: 'not-a-boolean',
        } as unknown as TimeEdit,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data.errors).to.have.length(1)
    expect(error.response?.data.errors[0].property).to.be.equal('isPaid')

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(unchanged!.note).to.be.eq(time.note)
    expect(unchanged!.isPaid).to.be.eq(time.isPaid)
  }
}

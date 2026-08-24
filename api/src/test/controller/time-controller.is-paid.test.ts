import { expect } from 'chai'
import faker from 'faker'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import {
  projectControllerEdit,
  timeControllerCreateOrUpdateMany,
  timeControllerMarkPaid,
  timeControllerMarkUnpaid,
} from '@app/api-client'
import type { TimeCreateDto as ApiTimeCreateDto } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { TimeRepository } from '@/repository/time-repository'
import { EProjectState } from '@/model/project'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'

@suite()
export class TimeControllerIsPaidTest extends BaseControllerTest {
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.timeRepository = this.container.get('TimeRepository')
  }

  private async grantAccess(
    project: Project,
    owner: User,
    worker: User,
    viewer: User,
  ) {
    await projectControllerEdit({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        title: project.title,
        text: project.text,
        state: project.state,
        workerAddresses: [worker.address],
        viewerAddresses: [viewer.address],
      },
      throwOnError: true,
    })
  }

  @test()
  async markPaid_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerMarkPaid({
        client: this.apiClient(),
        body: { ids: [faker.datatype.uuid()] },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('AuthenticationException')
  }

  @test()
  async markPaid_setsIsPaidForOwnerEntries() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const first = await this.timeFixture.create(
      project,
      moment.utc().subtract(120, 'minutes').toDate(),
      moment.utc().subtract(90, 'minutes').toDate(),
    )
    const second = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const res = await timeControllerMarkPaid({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: { ids: [first.id, second.id] },
      throwOnError: true,
    })

    const updatedFirst = await this.timeRepository.findOneBy({
      where: { id: first.id },
    })
    const updatedSecond = await this.timeRepository.findOneBy({
      where: { id: second.id },
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updatedFirst!.isPaid).to.be.true
    expect(updatedSecond!.isPaid).to.be.true
  }

  @test()
  async markUnpaid_clearsIsPaid() {
    const owner = await this.userFixture.createPremiumUser()
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

    const res = await timeControllerMarkUnpaid({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: { ids: [time.id] },
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updated!.isPaid).to.be.false
  }

  @test()
  async markPaid_deniedForOwnerOnWorkersEntry() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const fromAt = moment.utc().subtract(10, 'minutes').toISOString()
    const toAt = moment.utc().toISOString()
    const created = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: [
        {
          fromIndex: 1000,
          toIndex: 1001,
          note: 'worker entry',
          keyboardKeys: 1,
          minutesActive: 10,
          mouseKeys: 1,
          mouseDistance: 1,
          fromAt,
          toAt,
          projectId: project.id,
        },
      ] as ApiTimeCreateDto[],
      throwOnError: true,
    })

    const timeId = (created.data[0] as { id: string }).id

    let error: unknown

    try {
      await timeControllerMarkPaid({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: { ids: [timeId] },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: timeId },
    })
    expect(unchanged!.isPaid).to.be.false
  }

  @test()
  async markPaid_workerCanUpdateOwnEntries() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const fromAt = moment.utc().subtract(10, 'minutes').toISOString()
    const toAt = moment.utc().toISOString()
    const created = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: [
        {
          fromIndex: 1000,
          toIndex: 1001,
          note: 'worker entry',
          keyboardKeys: 1,
          minutesActive: 10,
          mouseKeys: 1,
          mouseDistance: 1,
          fromAt,
          toAt,
          projectId: project.id,
        },
      ] as ApiTimeCreateDto[],
      throwOnError: true,
    })

    const timeId = (created.data[0] as { id: string }).id

    await timeControllerMarkPaid({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: { ids: [timeId] },
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: timeId },
    })

    expect(updated!.isPaid).to.be.true
  }

  @test()
  async markPaid_deniedForViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      worker,
    )

    let error: unknown

    try {
      await timeControllerMarkPaid({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(viewer).accessToken,
        },
        body: { ids: [time.id] },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(unchanged!.isPaid).to.be.false
  }

  @test()
  async markPaid_deniedForWorkerOnAnotherUsersEntry() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      owner,
    )

    let error: unknown

    try {
      await timeControllerMarkPaid({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
        body: { ids: [time.id] },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(unchanged!.isPaid).to.be.false
  }

  @test()
  async markPaid_unknownIdDenied() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await timeControllerMarkPaid({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: { ids: [faker.datatype.uuid()] },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
  }

  @test()
  async markPaid_validationRejectsEmptyIds() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await timeControllerMarkPaid({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: { ids: [] },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data.errors[0].property).to.be.equal('ids')
  }
}

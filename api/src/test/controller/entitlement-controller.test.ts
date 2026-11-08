import { timeControllerCreateOrUpdateMany } from '@app/api-client'
import { suite, test } from '@testdeck/mocha'
import axios from 'axios'
import { expect } from 'chai'
import { randomUUID } from 'crypto'
import moment from 'moment'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { runPromise } from '@/service/effect-bridge'
import { UserManager } from '@/service/user-manager'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { getDataSource } from '@/connector/data-source'

/** What the billing service calls here, and what those calls change. */
@suite
export class EntitlementControllerTest extends BaseControllerTest {
  private savedSecret: string

  constructor() {
    super()
    this.savedSecret = this.parameters.entitlementSecret
    this.parameters.entitlementSecret = 'secret'
  }

  async after() {
    this.parameters.entitlementSecret = this.savedSecret
    await super.after()
  }

  private post(
    path: string,
    body: Record<string, unknown>,
    signature?: string,
  ) {
    const signed = this.container.get<EntitlementSignature>(
      'EntitlementSignature',
    )

    return axios.post(`${this.url}/api/internal/${path}`, body, {
      headers: {
        'X-Entitlement-Signature':
          signature ?? signed.sign(JSON.stringify(body)),
      },
    })
  }

  private async owned(owner: User, workers: string[]): Promise<Project> {
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = workers
    return runPromise(
      this.container
        .get<ProjectRepository>('ProjectRepository')
        .saveSingle(project),
    )
  }

  @test()
  async seats_answersWhatBillingReads() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    await this.owned(owner, [worker.address])

    const { data, status } = await this.post('seats', {
      userId: owner.id,
      from: moment.utc().subtract(1, 'month').toISOString(),
      to: moment.utc().add(1, 'day').toISOString(),
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    })

    expect(status).to.equal(200)
    expect(data.seats).to.equal(1)
    expect(data.connected).to.equal(1)
    expect(data.workers[0].address).to.equal(worker.address)
  }

  @test()
  async seats_refusesAForgedRequest() {
    const owner = await this.userFixture.createUser()
    let error: unknown

    await this.post(
      'seats',
      {
        userId: owner.id,
        issuedAt: Math.floor(Date.now() / 1000),
        nonce: randomUUID(),
      },
      'forged',
    ).catch((e) => {
      error = e
    })

    if (!axios.isAxiosError(error)) throw new Error('Expected a refusal')
    expect(error.response?.status).to.be.greaterThanOrEqual(401)
  }

  @test()
  async upgrading_bringsBackWhatRotationHid() {
    const owner = await this.userFixture.createUser()
    const project = await this.owned(owner, [])
    const old = moment.utc().subtract(30, 'days')
    const time = await this.timeFixture.create(
      project,
      old.toDate(),
      old.clone().add(10, 'minutes').toDate(),
      owner,
    )

    await runPromise(
      this.container
        .get<TimeRepository>('TimeRepository')
        .softDeleteExpiredEntriesForProjects([project.id], new Date()),
    )

    await this.post('entitlement', {
      userId: owner.id,
      premium: true,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    })

    expect(
      await getDataSource().getRepository(Time).findOneBy({ id: time.id }),
    ).to.not.equal(null)
  }

  @test()
  async trackingWorkers_letsAnOwnerChooseWhoKeepsTracking() {
    const owner = await this.userFixture.createUser()
    const workers = [
      await this.userFixture.createUser(),
      await this.userFixture.createUser(),
      await this.userFixture.createUser(),
    ]
    await this.owned(
      owner,
      workers.map((worker) => worker.address),
    )
    const headers = {
      Authorization: this.authenticator.getTokens(owner).accessToken,
    }

    const before = await axios.get(`${this.url}/api/user/tracking-workers`, {
      headers,
    })

    expect(before.data.limited).to.equal(true)
    expect(
      before.data.workers.map((w: { tracking: boolean }) => w.tracking),
    ).to.deep.equal([true, true, false])

    const after = await axios.put(
      `${this.url}/api/user/tracking-workers`,
      { addresses: [workers[2].address, workers[1].address] },
      { headers },
    )

    expect(
      after.data.workers.map((w: { tracking: boolean }) => w.tracking),
    ).to.deep.equal([false, true, true])
  }

  @test()
  async trackingWorkers_refusesSomeoneNotOnTheProjects() {
    const owner = await this.userFixture.createUser()
    const stranger = await this.userFixture.createUser()
    let error: unknown

    await axios
      .put(
        `${this.url}/api/user/tracking-workers`,
        { addresses: [stranger.address] },
        {
          headers: {
            Authorization: this.authenticator.getTokens(owner).accessToken,
          },
        },
      )
      .catch((e) => {
        error = e
      })

    if (!axios.isAxiosError(error)) throw new Error('Expected a refusal')
    expect(error.response?.status).to.equal(400)
  }

  @test()
  async aWorkerPastTheLimitCanStillSeeTheirProject() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.owned(owner, [
      (await this.userFixture.createUser()).address,
      (await this.userFixture.createUser()).address,
      worker.address,
    ])

    owner.premium = false
    await runPromise(
      this.container.get<UserManager>('UserManager').saveSingle(owner),
    )

    const { status } = await axios.get(
      `${this.url}/api/project/${project.id}`,
      {
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
      },
    )

    expect(status).to.equal(200)
  }

  /** The record stays open, but new time past the limit is refused. */
  @test()
  async aWorkerPastTheLimitCannotRecordNewTime() {
    const owner = await this.userFixture.createUser()
    const kept = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.owned(owner, [
      kept.address,
      (await this.userFixture.createUser()).address,
      worker.address,
    ])

    const upload = async (user: User) => {
      const { data } = await timeControllerCreateOrUpdateMany({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: [
          {
            fromIndex: 1000,
            toIndex: 1001,
            note: 'tracked',
            keyboardKeys: 1,
            minutesActive: 1,
            mouseKeys: 1,
            mouseDistance: 1,
            fromAt: moment.utc().subtract(10, 'minutes').toISOString(),
            toAt: moment.utc().toISOString(),
            projectId: project.id,
          },
        ] as never,
        throwOnError: true,
      })

      return (data as unknown as { error?: string }[])[0]
    }

    expect((await upload(kept)).error, 'first listed').to.equal(undefined)
    expect((await upload(worker)).error, 'past the limit').to.exist
  }
}

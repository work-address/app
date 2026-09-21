import { randomUUID } from 'crypto'
import axios from 'axios'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { ProjectRepository } from '@/repository/project-repository'

/**
 * WP-86: a paused marketplace contract stops new time on its project the
 * way an ended one does, a resume restores it, and neither can be undone by
 * a call that arrives out of order.
 */
@suite
export class MarketplacePauseControllerTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private post(
    path: string,
    header: string,
    body: Record<string, unknown>,
    signature?: string,
  ) {
    const raw = JSON.stringify(body)

    return axios.post(`${this.url}/api/internal/marketplace/${path}`, raw, {
      headers: {
        'Content-Type': 'application/json',
        [header]: signature ?? this.signature.sign(raw),
      },
      validateStatus: () => true,
    })
  }

  private pause(body: Record<string, unknown>, signature?: string) {
    return this.post('pause', 'X-Marketplace-Pause-Signature', body, signature)
  }

  private end(contractId: string) {
    return this.post('end', 'X-Marketplace-End-Signature', {
      contractId,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    })
  }

  private pauseBody(contractId: string, paused: boolean, sequence: number) {
    return {
      contractId,
      paused,
      sequence,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }
  }

  private async hired() {
    const client = await this.userFixture.createPremiumUser()
    const freelancer = await this.userFixture.createUser()
    const contractId = randomUUID()
    const hire = await this.post('hire', 'X-Marketplace-Signature', {
      contractId,
      clientId: client.id,
      freelancerId: freelancer.id,
      freelancerAddress: null,
      title: 'Payroll dashboard',
      text: 'Build the payroll table',
      rateHour: 45,
      weeklyLimit: null,
      weekStartsAt: null,
      trackScreenshots: false,
      trackProcesses: false,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    })

    return {
      freelancer,
      contractId,
      projectId: hire.data.projectId as string,
    }
  }

  private state(projectId: string) {
    return this.projectRepository
      .getRepo()
      .findOneOrFail({ where: { id: projectId } })
      .then((project) => project.state)
  }

  /** One ten-minute slice, ending `minutesAgo` before the one clock read. */
  private track(user: User, projectId: string, minutesAgo: number) {
    const toAt = moment.utc().subtract(minutesAgo, 'minutes')

    return axios.post(
      `${this.url}/api/time`,
      [
        {
          fromIndex: 9000 + minutesAgo,
          toIndex: 9001 + minutesAgo,
          note: 'work',
          keyboardKeys: 1,
          minutesActive: 10,
          mouseKeys: 1,
          mouseDistance: 1,
          fromAt: toAt.clone().subtract(10, 'minutes').toISOString(),
          toAt: toAt.toISOString(),
          projectId,
        },
      ],
      {
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        validateStatus: () => true,
      },
    )
  }

  /**
   * The point of it: a paused contract's project refuses the next slice
   * the way an ended one does, and a resume lets the one after it in.
   */
  @test
  async pause_stopsNewTime_andResumeRestoresIt() {
    const { freelancer, contractId, projectId } = await this.hired()

    const before = await this.track(freelancer, projectId, 60)
    const paused = await this.pause(this.pauseBody(contractId, true, 1))
    const during = await this.track(freelancer, projectId, 40)
    const pausedState = await this.state(projectId)
    const resumed = await this.pause(this.pauseBody(contractId, false, 2))
    const after = await this.track(freelancer, projectId, 20)

    expect(before.data[0].error).to.be.undefined
    expect(paused.status).to.be.eq(200)
    expect(paused.data).to.deep.eq({ projectId, paused: true, changed: true })
    expect(pausedState).to.be.eq(EProjectState.INACTIVE)
    expect(during.status).to.be.eq(200)
    expect(during.data[0].error?.name).to.be.eq('EntityNotFoundError')
    expect(resumed.data).to.deep.eq({
      projectId,
      paused: false,
      changed: true,
    })
    expect(after.data[0].error).to.be.undefined
    expect(await this.state(projectId)).to.be.eq(EProjectState.ACTIVE)
  }

  /**
   * A retry of the pause that lands after the resume changes nothing: the
   * project has already moved past it.
   */
  @test
  async aLatePause_cannotUndoALaterResume() {
    const { contractId, projectId } = await this.hired()

    await this.pause(this.pauseBody(contractId, true, 1))
    await this.pause(this.pauseBody(contractId, false, 2))

    const late = await this.pause(this.pauseBody(contractId, true, 1))
    const repeat = await this.pause(this.pauseBody(contractId, false, 2))

    expect(late.status).to.be.eq(200)
    expect(late.data).to.deep.eq({ projectId, paused: false, changed: false })
    expect(repeat.data.changed).to.be.false
    expect(await this.state(projectId)).to.be.eq(EProjectState.ACTIVE)
  }

  /**
   * Either side can end a paused contract, and a resume owed from before
   * the end never reopens the project after it.
   */
  @test
  async anEndedContract_staysClosed_whateverResumeArrives() {
    const { contractId, projectId } = await this.hired()

    await this.pause(this.pauseBody(contractId, true, 1))

    const ended = await this.end(contractId)
    const resumed = await this.pause(this.pauseBody(contractId, false, 2))
    const project = await this.projectRepository
      .getRepo()
      .findOneOrFail({ where: { id: projectId } })

    expect(ended.status).to.be.eq(200)
    expect(resumed.status).to.be.eq(200)
    expect(resumed.data).to.deep.eq({
      projectId,
      paused: true,
      changed: false,
    })
    expect(project.state).to.be.eq(EProjectState.INACTIVE)
    expect(project.marketplaceEndedAt).to.be.ok
  }

  /** Nothing to pause for a hire that never opened a project. */
  @test
  async pause_forAContractWithNoProject_succeedsWithNothingToChange() {
    const res = await this.pause(this.pauseBody(randomUUID(), true, 1))

    expect(res.status).to.be.eq(200)
    expect(res.data).to.deep.eq({
      projectId: null,
      paused: true,
      changed: false,
    })
  }

  /**
   * Signed under its own header, inside the window, once: an end's
   * signature does not pause anything, and a captured pause cannot be
   * replayed.
   */
  @test
  async pause_rejectsForgedStaleReplayedAndMisaddressedCalls() {
    const { contractId, projectId } = await this.hired()
    const body = this.pauseBody(contractId, true, 1)

    const forged = await this.pause(body, 'deadbeef')
    const stale = await this.pause({
      ...this.pauseBody(contractId, true, 1),
      issuedAt: Math.floor(Date.now() / 1000) - 3600,
    })
    const inTheEndsHeader = await this.post(
      'pause',
      'X-Marketplace-End-Signature',
      this.pauseBody(contractId, true, 1),
    )
    const stateAfterRefusals = await this.state(projectId)
    const first = await this.pause(body)
    const replay = await this.pause(body)

    expect(forged.status).to.be.eq(401)
    expect(stale.status).to.be.eq(401)
    expect(inTheEndsHeader.status).to.be.eq(401)
    expect(stateAfterRefusals).to.be.eq(EProjectState.ACTIVE)
    expect(first.status).to.be.eq(200)
    expect(replay.status).to.be.eq(401)
  }
}

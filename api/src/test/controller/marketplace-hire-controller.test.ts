import { randomUUID } from 'crypto'
import axios from 'axios'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EInvoiceState } from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { ProjectRepository } from '@/repository/project-repository'
import { WalletAddress } from '@/service/wallet-address'

@suite
export class MarketplaceHireControllerTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private post(body: Record<string, unknown>, signature?: string) {
    const raw = JSON.stringify(body)

    return axios.post(`${this.url}/api/internal/marketplace/hire`, raw, {
      headers: {
        'Content-Type': 'application/json',
        'X-Marketplace-Signature': signature ?? this.signature.sign(raw),
      },
      validateStatus: () => true,
    })
  }

  private body(overrides: Record<string, unknown>) {
    return {
      contractId: randomUUID(),
      clientId: randomUUID(),
      freelancerId: randomUUID(),
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
      ...overrides,
    }
  }

  @test
  async hire_createsOneProjectPerContract() {
    const client = await this.userFixture.createUser()
    const freelancer = await this.userFixture.createUser()
    const body = this.body({
      clientId: client.id,
      freelancerId: freelancer.id,
    })

    const first = await this.post(body)
    const retry = await this.post({ ...body, nonce: randomUUID() })
    const project = await this.projectRepository
      .getRepo()
      .findOne({ where: { marketplaceContractId: body.contractId } })

    expect(first.status).to.be.eq(200)
    expect(first.data.created).to.be.true
    expect(retry.data.created).to.be.false
    expect(retry.data.projectId).to.be.eq(first.data.projectId)
    expect(project?.user.id).to.be.eq(client.id)
    expect(project?.title).to.be.eq('Payroll dashboard')
    expect(Number(project?.rateHour)).to.be.eq(45)
    expect(project?.workerAddresses).to.deep.eq([
      WalletAddress.toCanonical(freelancer.address),
    ])
  }

  /**
   * The offer disclosed what would be recorded and how many hours a week,
   * and the project is where that agreement takes effect - not this
   * service's defaults, which used to open every hired project with
   * monitoring off whatever the freelancer had accepted (WP-38).
   */
  @test
  async hire_appliesTheAcceptedMonitoringAndWeeklyCap() {
    const client = await this.userFixture.createUser()
    const freelancer = await this.userFixture.createUser()
    const body = this.body({
      clientId: client.id,
      freelancerId: freelancer.id,
      trackScreenshots: true,
      trackProcesses: true,
      weeklyLimit: 20,
      weekStartsAt: 1788825600,
    })

    const res = await this.post(body)
    const project = await this.projectRepository
      .getRepo()
      .findOne({ where: { id: res.data.projectId } })

    expect(res.status).to.be.eq(200)
    expect(project?.trackScreenshots).to.be.true
    expect(project?.trackProcesses).to.be.true
    expect(project?.weeklyLimit).to.be.eq(20)
    // The contract's own week, so the cap is measured against the same
    // seven days the marketplace shows hours for.
    expect(project?.weeklyPeriodStartsAt?.toISOString()).to.be.eq(
      new Date(1788825600 * 1000).toISOString(),
    )
  }

  /**
   * A hire that names none of them agrees to none of them: monitoring stays
   * off and the hours are uncapped, rather than a missing field being read
   * as consent.
   */
  @test
  async hire_leavesMonitoringOffAndUncappedWhenTheTermsSaidNothing() {
    const client = await this.userFixture.createUser()
    const res = await this.post(this.body({ clientId: client.id }))
    const project = await this.projectRepository
      .getRepo()
      .findOne({ where: { id: res.data.projectId } })

    expect(project?.trackScreenshots).to.not.be.ok
    expect(project?.trackProcesses).to.not.be.ok
    expect(project?.weeklyLimit ?? null).to.be.null
  }

  /** A cap nobody could work is a mistake in the terms, not a project. */
  @test
  async hire_refusesAWeeklyCapAWeekCannotHold() {
    const client = await this.userFixture.createUser()
    const body = this.body({ clientId: client.id, weeklyLimit: 200 })

    const res = await this.post(body)
    const projects = await this.projectRepository
      .getRepo()
      .count({ where: { marketplaceContractId: body.contractId } })

    expect(res.status).to.be.eq(400)
    expect(projects).to.be.eq(0)
  }

  @test
  async hire_givesTheWorkerAccessWithoutPremium() {
    const client = await this.userFixture.createUser()
    const freelancer = await this.userFixture.createUser()
    const outsider = await this.userFixture.createUser()
    const res = await this.post(
      this.body({ clientId: client.id, freelancerId: freelancer.id }),
    )

    const readAs = (token: string) =>
      axios.get(`${this.url}/api/project/${res.data.projectId}`, {
        headers: { Authorization: token },
        validateStatus: () => true,
      })
    const read = await readAs(
      this.authenticator.getTokens(freelancer).accessToken,
    )
    const denied = await readAs(
      this.authenticator.getTokens(outsider).accessToken,
    )

    expect(client.premium).to.not.be.ok
    expect(read.status).to.be.eq(200)
    expect(denied.status).to.not.be.eq(200)
  }

  @test
  async hire_usesTheGivenAddressForAnUnknownFreelancer() {
    const client = await this.userFixture.createUser()
    const address = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
    const body = this.body({ clientId: client.id, freelancerAddress: address })

    const res = await this.post(body)
    const project = await this.projectRepository
      .getRepo()
      .findOne({ where: { id: res.data.projectId } })

    expect(res.data.created).to.be.true
    expect(project?.workerAddresses).to.deep.eq([
      WalletAddress.toCanonical(address),
    ])
  }

  @test
  async hire_refusesAnUnknownClientAsAConflict() {
    const body = this.body({})
    const res = await this.post(body)
    const projects = await this.projectRepository
      .getRepo()
      .count({ where: { marketplaceContractId: body.contractId } })

    expect(res.status).to.be.eq(409)
    expect(projects).to.be.eq(0)
  }

  @test
  async hire_racingRetriesCreateOneProjectAndOnlyOneSaysCreated() {
    const client = await this.userFixture.createUser()
    const body = this.body({ clientId: client.id })

    const [a, b] = await Promise.all([
      this.post(body),
      this.post({ ...body, nonce: randomUUID() }),
    ])
    const projects = await this.projectRepository
      .getRepo()
      .count({ where: { marketplaceContractId: body.contractId } })

    expect(a.status).to.be.eq(200)
    expect(b.status).to.be.eq(200)
    expect(a.data.projectId).to.be.eq(b.data.projectId)
    expect(projects).to.be.eq(1)
    expect([a.data.created, b.data.created].filter(Boolean)).to.have.length(1)
  }

  @test
  async hire_rejectsBadSignatureStaleCallsAndReplays() {
    const client = await this.userFixture.createUser()
    const body = this.body({ clientId: client.id })

    const forged = await this.post(body, 'deadbeef')
    const stale = await this.post({
      ...body,
      issuedAt: Math.floor(Date.now() / 1000) - 3600,
    })
    const first = await this.post(body)
    const replay = await this.post(body)

    expect(forged.status).to.be.eq(401)
    expect(stale.status).to.be.eq(401)
    expect(first.status).to.be.eq(200)
    expect(replay.status).to.be.eq(401)
  }
}

/**
 * Ending a marketplace contract, from app's side: the project stops taking
 * new time and keeps everything already recorded. Its own suite because it
 * is a different call with a different header, not a variation on the hire.
 */
@suite
export class MarketplaceEndControllerTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private postHire(body: Record<string, unknown>) {
    const raw = JSON.stringify(body)

    return axios.post(`${this.url}/api/internal/marketplace/hire`, raw, {
      headers: {
        'Content-Type': 'application/json',
        'X-Marketplace-Signature': this.signature.sign(raw),
      },
      validateStatus: () => true,
    })
  }

  private postEnd(body: Record<string, unknown>, signature?: string) {
    const raw = JSON.stringify(body)

    return axios.post(`${this.url}/api/internal/marketplace/end`, raw, {
      headers: {
        'Content-Type': 'application/json',
        'X-Marketplace-End-Signature': signature ?? this.signature.sign(raw),
      },
      validateStatus: () => true,
    })
  }

  private endBody(contractId: string, overrides: Record<string, unknown> = {}) {
    return {
      contractId,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
      ...overrides,
    }
  }

  private postTime(token: string, projectId: string) {
    // One clock read, both ends derived from it.
    const toAt = moment.utc()

    return axios.post(
      `${this.url}/api/time`,
      [
        {
          fromIndex: 5000,
          toIndex: 5001,
          note: 'after the contract ended',
          keyboardKeys: 1,
          minutesActive: 10,
          mouseKeys: 1,
          mouseDistance: 1,
          fromAt: toAt.clone().subtract(10, 'minutes').toISOString(),
          toAt: toAt.toISOString(),
          projectId,
        },
      ],
      { headers: { Authorization: token }, validateStatus: () => true },
    )
  }

  /** A hired project, with the freelancer as its worker. */
  private async hired() {
    const client = await this.userFixture.createPremiumUser()
    const freelancer = await this.userFixture.createUser()
    const contractId = randomUUID()
    const hire = await this.postHire({
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
      client,
      freelancer,
      contractId,
      projectId: hire.data.projectId as string,
    }
  }

  /**
   * The point of the whole call: what stops is future time, and nothing
   * else. The freelancer's next slice is refused for that row alone, and
   * the invoice raised while the contract ran is still readable afterwards.
   */
  @test
  async end_stopsNewTime_andKeepsTheInvoicesReadable() {
    const { client, freelancer, contractId, projectId } = await this.hired()
    const token = this.authenticator.getTokens(freelancer).accessToken
    const project = await this.projectRepository
      .getRepo()
      .findOneOrFail({ where: { id: projectId } })
    const invoice = await this.invoiceFixture.create(
      project,
      12_000,
      EInvoiceState.REQUESTED,
    )

    const before = await this.postTime(token, projectId)
    const ended = await this.postEnd(this.endBody(contractId))
    const after = await this.postTime(token, projectId)
    const readInvoice = await axios.get(
      `${this.url}/api/invoice/${invoice.id}`,
      {
        headers: {
          Authorization: this.authenticator.getTokens(client).accessToken,
        },
        validateStatus: () => true,
      },
    )
    const closed = await this.projectRepository
      .getRepo()
      .findOneOrFail({ where: { id: projectId } })

    expect(before.data[0].error, 'before the end the slice is accepted').to.be
      .undefined
    expect(ended.status).to.be.eq(200)
    expect(ended.data).to.deep.eq({ projectId, closed: true })
    expect(closed.state).to.be.eq(EProjectState.INACTIVE)
    // A per-row error, not a failed batch: another project's slices in the
    // same upload still land.
    expect(after.status).to.be.eq(200)
    expect(after.data[0].error?.name).to.be.eq('EntityNotFoundError')
    expect(readInvoice.status).to.be.eq(200)
  }

  /**
   * Hours already recorded are the record of what happened, so ending
   * deletes nothing and the freelancer can still read back the slice they
   * tracked. (The dashboard's time search hides every INACTIVE project's
   * rows, closed by hand or by a contract ending alike - that is the app's
   * own rule about closed projects and not something ending decides.)
   */
  @test
  async end_leavesTimeAlreadyRecordedInPlace() {
    const { freelancer, contractId, projectId } = await this.hired()
    const token = this.authenticator.getTokens(freelancer).accessToken

    const recorded = await this.postTime(token, projectId)
    const timeId = recorded.data[0].id as string

    await this.postEnd(this.endBody(contractId))

    const read = await axios.get(`${this.url}/api/time/${timeId}`, {
      headers: { Authorization: token },
      validateStatus: () => true,
    })

    expect(timeId).to.be.ok
    expect(read.status).to.be.eq(200)
    expect(read.data.id).to.be.eq(timeId)
    expect(read.data.deletedAt ?? null).to.be.null
  }

  /** The sweeper retries, so a second end must change nothing twice. */
  @test
  async end_repeatedIsANoOp() {
    const { contractId, projectId } = await this.hired()

    const first = await this.postEnd(this.endBody(contractId))
    const again = await this.postEnd(this.endBody(contractId))

    expect(first.data).to.deep.eq({ projectId, closed: true })
    expect(again.status).to.be.eq(200)
    expect(again.data).to.deep.eq({ projectId, closed: false })
  }

  /**
   * A contract whose hire never opened a project has nothing left to stop.
   * Answering an error would leave the marketplace retrying for ever.
   */
  @test
  async end_forAContractWithNoProject_succeedsWithNothingToClose() {
    const res = await this.postEnd(this.endBody(randomUUID()))

    expect(res.status).to.be.eq(200)
    expect(res.data).to.deep.eq({ projectId: null, closed: false })
  }

  /** A captured hire must not be replayable as an end, nor the other way. */
  @test
  async end_rejectsBadSignatureStaleCallsAndReplays() {
    const { contractId } = await this.hired()
    const body = this.endBody(contractId)

    const forged = await this.postEnd(body, 'deadbeef')
    const stale = await this.postEnd(
      this.endBody(contractId, {
        issuedAt: Math.floor(Date.now() / 1000) - 3600,
      }),
    )
    const first = await this.postEnd(body)
    const replay = await this.postEnd(body)

    expect(forged.status).to.be.eq(401)
    expect(stale.status).to.be.eq(401)
    expect(first.status).to.be.eq(200)
    expect(replay.status).to.be.eq(401)
  }

  /**
   * The end is signed under its own header: a hire signature in the hire's
   * header does not authorise closing anything.
   */
  @test
  async end_refusesASignatureSentInTheHiresHeader() {
    const { contractId, projectId } = await this.hired()
    const body = this.endBody(contractId)
    const raw = JSON.stringify(body)

    const res = await axios.post(`${this.url}/api/internal/marketplace/end`, raw, {
      headers: {
        'Content-Type': 'application/json',
        'X-Marketplace-Signature': this.signature.sign(raw),
      },
      validateStatus: () => true,
    })
    const project = await this.projectRepository
      .getRepo()
      .findOneOrFail({ where: { id: projectId } })

    expect(res.status).to.be.eq(401)
    expect(project.state).to.be.eq(EProjectState.ACTIVE)
  }
}

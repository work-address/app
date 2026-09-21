import { randomUUID } from 'crypto'
import axios from 'axios'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { Invoice } from '@/entity/invoice'
import { User } from '@/entity/user'
import { EInvoiceState } from '@/model/invoice'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { ProjectRepository } from '@/repository/project-repository'
import { getDataSource } from '@/connector/data-source'

/**
 * WP-85: a new version of a marketplace contract's terms reaches the same
 * project, from the date both sides agreed, and reaches back into nothing -
 * not an invoice already issued, not an hour worked before that date.
 */
@suite
export class MarketplaceAmendControllerTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  /** The route a header belongs to, so each call is signed for its own. */
  private route(header: string) {
    const route = InternalRoute.ALL.find((known) => known.header === header)

    if (!route) {
      throw new Error(`No internal route signs under ${header}`)
    }

    return route
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
        [header]: signature ?? this.signature.sign(this.route(header), raw),
      },
      validateStatus: () => true,
    })
  }

  private amend(body: Record<string, unknown>, signature?: string) {
    return this.post('amend', 'X-Marketplace-Amend-Signature', body, signature)
  }

  private amendBody(
    contractId: string,
    effectiveFrom: Date,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      contractId,
      version: 2,
      effectiveFrom: Math.floor(effectiveFrom.getTime() / 1000),
      rateHour: 60,
      weeklyLimit: 25,
      trackScreenshots: false,
      trackProcesses: true,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
      ...overrides,
    }
  }

  /** A hired project at 45 an hour, with the freelancer as its worker. */
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
      weeklyLimit: 20,
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

  private project(projectId: string) {
    return this.projectRepository
      .getRepo()
      .findOneOrFail({ where: { id: projectId } })
  }

  /** A slice of tracked time starting at `fromAt`, `minutes` long, all active. */
  private track(
    user: User,
    projectId: string,
    fromAt: moment.Moment,
    minutes: number,
    index: number,
  ) {
    return axios.post(
      `${this.url}/api/time`,
      [
        {
          fromIndex: index,
          toIndex: index + 1,
          note: 'work',
          keyboardKeys: 1,
          minutesActive: minutes,
          mouseKeys: 1,
          mouseDistance: 1,
          fromAt: fromAt.toISOString(),
          toAt: fromAt.clone().add(minutes, 'minutes').toISOString(),
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

  /** The freelancer's "invoice what is outstanding" button. */
  private async invoiceOutstanding(user: User, projectId: string) {
    const res = await axios.post(
      `${this.url}/api/invoice/project/${projectId}`,
      {},
      {
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        validateStatus: () => true,
      },
    )

    expect(res.status, JSON.stringify(res.data)).to.be.oneOf([200, 201])

    return getDataSource()
      .getRepository(Invoice)
      .findOneOrFail({ where: { id: res.data.id as string } })
  }

  /**
   * The acceptance, end to end: the same project takes the new rate, cap
   * and monitoring; the invoice issued before is exactly what it was; and
   * the hours on either side of the agreed date are billed at the rate
   * agreed for them, on separate invoices.
   */
  @test
  async amend_movesTheSameProjectToTheNewTerms_fromTheAgreedDateOnly() {
    const { freelancer, contractId, projectId } = await this.hired()
    const now = moment.utc()
    const effectiveFrom = now.clone().subtract(1, 'hour')
    const old = await this.invoiceFixture.create(
      await this.project(projectId),
      12_000,
      EInvoiceState.REQUESTED,
    )

    const before = await this.track(
      freelancer,
      projectId,
      now.clone().subtract(2, 'hours'),
      60,
      7000,
    )
    const after = await this.track(
      freelancer,
      projectId,
      now.clone().subtract(30, 'minutes'),
      30,
      7100,
    )
    const res = await this.amend(
      this.amendBody(contractId, effectiveFrom.toDate()),
    )
    const project = await this.project(projectId)

    expect(before.data[0].error).to.be.undefined
    expect(after.data[0].error).to.be.undefined
    expect(res.status, JSON.stringify(res.data)).to.be.eq(200)
    expect(res.data).to.deep.eq({ projectId, version: 2, applied: true })
    expect(project.id).to.be.eq(projectId)
    expect(Number(project.rateHour)).to.be.eq(60)
    expect(project.weeklyLimit).to.be.eq(25)
    expect(project.trackProcesses).to.be.true
    expect(project.marketplaceTerms?.map((v) => v.version)).to.deep.eq([1, 2])
    expect(project.marketplaceTerms?.[0]).to.include({
      rateHour: 45,
      weeklyLimit: 20,
      effectiveFrom: null,
    })

    const unchanged = await getDataSource()
      .getRepository(Invoice)
      .findOneOrFail({ where: { id: old.id } })

    expect(unchanged.amountCents).to.be.eq(old.amountCents)
    expect(unchanged.rateHourCents ?? null).to.be.eq(old.rateHourCents ?? null)

    // One invoice, one rate: the hour before the date at 45, then the half
    // hour after it at 60.
    const first = await this.invoiceOutstanding(freelancer, projectId)
    const second = await this.invoiceOutstanding(freelancer, projectId)

    expect(first.rateHourCents).to.be.eq(4500)
    expect(first.amountCents).to.be.eq(4500)
    expect(second.rateHourCents).to.be.eq(6000)
    expect(second.amountCents).to.be.eq(3000)
  }

  /** The marketplace retries after a lost answer; a repeat changes nothing. */
  @test
  async amend_repeatedIsANoOp_andTheSameVersionWithOtherTermsIsA409() {
    const { contractId, projectId } = await this.hired()
    const effectiveFrom = new Date()
    const body = this.amendBody(contractId, effectiveFrom)

    const first = await this.amend(body)
    const again = await this.amend({ ...body, nonce: randomUUID() })
    const other = await this.amend({
      ...body,
      rateHour: 70,
      nonce: randomUUID(),
    })
    const project = await this.project(projectId)

    expect(first.data.applied).to.be.true
    expect(again.status).to.be.eq(200)
    expect(again.data).to.deep.eq({ projectId, version: 2, applied: false })
    expect(other.status).to.be.eq(409)
    expect(Number(project.rateHour)).to.be.eq(60)
    expect(project.marketplaceTerms).to.have.length(2)
  }

  /**
   * Versions follow one another: a later version that starts before the
   * one it follows is a 409, and an earlier one arriving late is placed
   * where it belongs without taking the project off the newest terms.
   */
  @test
  async amend_keepsTheVersionsInOrder() {
    const { contractId, projectId } = await this.hired()
    const now = Date.now()
    const third = await this.amend(
      this.amendBody(contractId, new Date(now - 1000), {
        version: 3,
        rateHour: 70,
      }),
    )
    const late = await this.amend(
      this.amendBody(contractId, new Date(now - 3_600_000), {
        version: 2,
        rateHour: 60,
      }),
    )
    const backwards = await this.amend(
      this.amendBody(contractId, new Date(now - 7_200_000), {
        version: 4,
        rateHour: 80,
      }),
    )
    const project = await this.project(projectId)

    expect(third.data.applied).to.be.true
    expect(late.data.applied).to.be.true
    expect(backwards.status).to.be.eq(409)
    expect(project.marketplaceTerms?.map((v) => v.version)).to.deep.eq([
      1, 2, 3,
    ])
    expect(Number(project.rateHour)).to.be.eq(70)
  }

  /** Only a hire that opened a project can be amended there. */
  @test
  async amend_forAContractWithNoProjectIsA404() {
    const res = await this.amend(this.amendBody(randomUUID(), new Date()))

    expect(res.status).to.be.eq(404)
  }

  /**
   * Signed under its own header, inside the replay window, once: a
   * captured hire or end cannot be replayed as a change of rate.
   */
  @test
  async amend_rejectsForgedStaleReplayedAndMisaddressedCalls() {
    const { contractId, projectId } = await this.hired()
    const body = this.amendBody(contractId, new Date())

    const forged = await this.amend(body, 'deadbeef')
    const stale = await this.amend(
      this.amendBody(contractId, new Date(), {
        issuedAt: Math.floor(Date.now() / 1000) - 3600,
      }),
    )
    const inTheEndsHeader = await this.post(
      'amend',
      'X-Marketplace-End-Signature',
      this.amendBody(contractId, new Date()),
    )
    const first = await this.amend(body)
    const replay = await this.amend(body)
    const project = await this.project(projectId)

    expect(forged.status).to.be.eq(401)
    expect(stale.status).to.be.eq(401)
    expect(inTheEndsHeader.status).to.be.eq(401)
    expect(first.status).to.be.eq(200)
    expect(replay.status).to.be.eq(401)
    expect(project.marketplaceTerms).to.have.length(2)
  }
}

import { randomUUID } from 'crypto'
import axios from 'axios'
import moment from 'moment'
import { expect } from 'chai'
import { suite, test, timeout } from '@testdeck/mocha'
import {
  invoiceControllerCreate,
  invoiceControllerRead,
  invoiceControllerRecord,
} from '@app/api-client'

import { App } from '@/app/app'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ConcurrentCalls } from '@/test/fixture/concurrent-calls'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import {
  EInvoiceBasis,
  EInvoiceIssuanceKind,
  EInvoiceState,
} from '@/model/invoice'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'

/**
 * MS-03: a fixed-price milestone is billed as a FIXED invoice - an agreed
 * sum for a named piece of work, with no tracked entries behind it.
 *
 * The rejected alternative is what these tests pin down: fabricating Time
 * rows that add up to the agreed price would put hours nobody worked into
 * the work record, and `Time` is the only record of work (SPEC.md). So the
 * invoice carries no lines and no rate, says what it is billing for, and
 * every reader of it has to cope with zero minutes rather than divide by
 * them.
 *
 * Each test declares a 20s budget: signed pushes, reads and races that run
 * in about a second alone, and past mocha's 2s default on a shared machine.
 */
@suite()
export class MarketplaceFixedInvoiceTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected invoiceRepository: InvoiceRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.timeRepository = this.container.get('TimeRepository')
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  private post(body: Record<string, unknown>, signature?: string) {
    const raw = JSON.stringify(body)

    return axios.post(
      `${this.url}/api/internal/marketplace/milestone-invoice`,
      raw,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Marketplace-Milestone-Signature':
            signature ??
            this.signature.sign(InternalRoute.MILESTONE_INVOICE, raw),
        },
        validateStatus: () => true,
      },
    )
  }

  /**
   * A milestone delivered over a week that ended an hour ago. One clock read,
   * both ends derived from it, so the span is exact.
   */
  private body(overrides: Record<string, unknown>) {
    const end = moment.utc().startOf('minute').subtract(1, 'hour')

    return {
      contractId: randomUUID(),
      milestoneRef: randomUUID(),
      freelancerId: randomUUID(),
      amountCents: 250000,
      description: 'Milestone 2: the payroll export, delivered and accepted',
      workStart: end.clone().subtract(7, 'days').unix(),
      workEnd: end.unix(),
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
      ...overrides,
    }
  }

  /** A hired project with its client, its freelancer and its contract id. */
  private async hired(): Promise<{
    client: User
    freelancer: User
    project: Project
  }> {
    const client = await this.userFixture.createUser()
    const freelancer = await this.userFixture.createUser()
    // Rate 0: a fixed-price hire agrees no hourly rate at all, which is
    // exactly the case where reading one off the project would be wrong.
    const project = await this.projectFixture.createHired(client, freelancer, 0)

    return { client, freelancer, project }
  }

  private stored(id: string): Promise<Invoice | undefined> {
    return runPromise(
      this.invoiceRepository.findOneBy({
        where: { id },
        relations: { project: true, user: true },
      }),
    )
  }

  /**
   * The acceptance case: the invoice bills the agreed sum, says what for,
   * and has no time behind it - so the roll-up the page reads reports no
   * rate and no minutes instead of dividing the sum by zero.
   */
  @test()
  @timeout(20000)
  async milestone_billsTheAgreedSumWithNoTimeBehindIt() {
    const { freelancer, project } = await this.hired()
    const body = this.body({
      contractId: project.marketplaceContractId,
      freelancerId: freelancer.id,
    })

    const pushed = await this.post(body)

    expect(pushed.status).to.be.eq(200)
    expect(pushed.data.created).to.be.true

    const read = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: pushed.data.invoiceId as never },
      headers: this.auth(freelancer),
      throwOnError: true,
    })

    expect(read.data.basis).to.be.eq(EInvoiceBasis.FIXED)
    expect(Number(read.data.amountCents)).to.be.eq(250000)
    expect(read.data.description).to.be.eq(body.description)
    expect(read.data.milestoneRef).to.be.eq(body.milestoneRef)
    expect(read.data.issuanceKind).to.be.eq(EInvoiceIssuanceKind.MILESTONE)
    // No lines, no entries, and no arithmetic over them.
    expect(read.data.lines).to.deep.eq([])
    expect(read.data.time).to.deep.eq([])
    expect(read.data.report?.rateHour).to.be.eq(null)
    expect(read.data.report?.rateTotal).to.be.eq(null)
    expect(read.data.report?.minutes).to.be.eq(0)
    expect(read.data.report?.minutesActive).to.be.eq(0)
    expect(read.data.report?.minutesPaid).to.be.eq(0)
    expect(read.data.report?.minutesUnpaid).to.be.eq(0)

    for (const value of Object.values(read.data.report ?? {})) {
      expect(Number.isNaN(Number(value)), JSON.stringify(read.data.report)).to
        .be.false
    }

    // The record an escrow commitment hashes says what the sum is for, not
    // only how much it is.
    const record = await invoiceControllerRecord({
      client: this.apiClient(),
      path: { id: pushed.data.invoiceId as never },
      headers: this.auth(freelancer),
      throwOnError: true,
    })

    expect(record.data).to.deep.include({
      basis: EInvoiceBasis.FIXED,
      milestoneRef: body.milestoneRef,
      description: body.description,
      amountCents: 250000,
      minutesActive: 0,
      lines: [],
    })

    // The work record gained nothing: no entry was invented to stand behind
    // the sum.
    const entries = await this.timeRepository
      .getRepo()
      .count({ where: { project: { id: project.id } } })

    expect(entries).to.be.eq(0)
  }

  /**
   * Paid by hand like any other invoice. Marking one paid cascades to the
   * entries it bills, and a fixed invoice bills none: the cascade has
   * nothing to touch, the invoice still turns PAID and back, and no entry
   * appears to carry the flag.
   */
  @test()
  @timeout(20000)
  async milestone_isMarkedPaidAndBackWithNoEntriesToCascadeTo() {
    const { client, freelancer, project } = await this.hired()
    const pushed = await this.post(
      this.body({
        contractId: project.marketplaceContractId,
        freelancerId: freelancer.id,
      }),
    )

    expect(pushed.status, JSON.stringify(pushed.data)).to.be.eq(200)

    const mark = (route: 'paid' | 'unpaid', user: User) =>
      axios.post(
        `${this.url}/api/invoice/${pushed.data.invoiceId}/${route}`,
        undefined,
        { headers: this.auth(user), validateStatus: () => true },
      )

    // The client pays it; only the freelancer owed the money says it came.
    expect((await mark('paid', client)).status).to.be.eq(403)

    const paid = await mark('paid', freelancer)

    expect(paid.status, JSON.stringify(paid.data)).to.be.eq(200)
    expect(paid.data.state).to.be.eq(EInvoiceState.PAID)
    expect(paid.data.basis).to.be.eq(EInvoiceBasis.FIXED)
    expect(Number(paid.data.amountCents)).to.be.eq(250000)

    const unpaid = await mark('unpaid', freelancer)

    expect(unpaid.status, JSON.stringify(unpaid.data)).to.be.eq(200)
    expect(unpaid.data.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(unpaid.data.paidAt ?? null).to.be.eq(null)

    const entries = await this.timeRepository
      .getRepo()
      .count({ where: { project: { id: project.id } } })

    expect(entries).to.be.eq(0)
  }

  /** The period the milestone names is the invoice's own period. */
  @test()
  @timeout(20000)
  async milestone_takesItsPeriodFromTheMilestone() {
    const { freelancer, project } = await this.hired()
    const body = this.body({
      contractId: project.marketplaceContractId,
      freelancerId: freelancer.id,
    })

    const pushed = await this.post(body)
    const invoice = await this.stored(pushed.data.invoiceId)

    expect(invoice?.fromAt.toISOString()).to.be.eq(
      new Date((body.workStart as number) * 1000).toISOString(),
    )
    expect(invoice?.toAt.toISOString()).to.be.eq(
      new Date((body.workEnd as number) * 1000).toISOString(),
    )
    // A milestone is not a cadence period, so the scheduled unique key never
    // compares it with anything.
    expect(invoice?.periodStart ?? null).to.be.eq(null)
    expect(invoice?.periodEnd ?? null).to.be.eq(null)
  }

  /** The acceptance case: a duplicate milestone gives one invoice. */
  @test()
  @timeout(20000)
  async milestone_pushedTwice_billsOnce() {
    const { freelancer, project } = await this.hired()
    const body = this.body({
      contractId: project.marketplaceContractId,
      freelancerId: freelancer.id,
    })

    const first = await this.post(body)
    const retry = await this.post({
      ...body,
      nonce: randomUUID(),
      issuedAt: Math.floor(Date.now() / 1000),
    })

    expect(first.status).to.be.eq(200)
    expect(retry.status).to.be.eq(200)
    expect(first.data.created).to.be.true
    expect(retry.data.created).to.be.false
    expect(retry.data.invoiceId).to.be.eq(first.data.invoiceId)

    const count = await this.invoiceRepository
      .getRepo()
      .count({ where: { project: { id: project.id } } })

    expect(count).to.be.eq(1)
  }

  /**
   * And when the retry overlaps the first push rather than following it: one
   * row is inserted, the other call reads it, and only one says `created`.
   */
  @test()
  @timeout(20000)
  async milestone_racingPushes_billOnce() {
    const { freelancer, project } = await this.hired()
    const milestoneRef = randomUUID()
    const bill = () =>
      this.post(
        this.body({
          contractId: project.marketplaceContractId,
          freelancerId: freelancer.id,
          milestoneRef,
        }),
      )

    const results = await new ConcurrentCalls(App.conn).settle([bill, bill])

    const responses = results.map((result) =>
      result.status === 'fulfilled' ? result.value : null,
    )

    expect(responses.every((response) => response?.status === 200)).to.be.true
    expect(
      responses.filter((response) => response?.data.created).length,
    ).to.be.eq(1)
    expect(
      new Set(responses.map((response) => response?.data.invoiceId)).size,
    ).to.be.eq(1)

    const count = await this.invoiceRepository
      .getRepo()
      .count({ where: { project: { id: project.id } } })

    expect(count).to.be.eq(1)
  }

  /**
   * The acceptance case: historical hourly invoices are unchanged. An
   * invoice raised the ordinary way still bills its entries at the project's
   * rate and reports both.
   */
  @test()
  @timeout(20000)
  async hourlyInvoices_areUnchangedByTheNewBasis() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const start = moment.utc().startOf('minute').subtract(3, 'hours')
    const time = await this.timeFixture.create(
      project,
      start.toDate(),
      start.clone().add(1, 'hour').toDate(),
      owner,
    )

    time.minutesActive = 60
    await runPromise(this.timeRepository.saveSingle(time))

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(owner),
      body: {},
      throwOnError: true,
    })

    const read = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: created.data.id as never },
      headers: this.auth(owner),
      throwOnError: true,
    })

    expect(read.data.basis).to.be.eq(EInvoiceBasis.HOURLY)
    expect(read.data.milestoneRef ?? null).to.be.eq(null)
    expect(Number(read.data.amountCents)).to.be.eq(2000)
    expect(read.data.report?.rateHour).to.be.eq(20)
    expect(read.data.report?.rateTotal).to.be.eq(20)
    expect(read.data.report?.minutesActive).to.be.eq(60)
    expect(read.data.lines?.length).to.be.eq(1)
  }

  /**
   * The acceptance case from the other side: a row written before the basis
   * existed - an insert that names no basis, as every historical invoice's
   * did - reads back as HOURLY, with its own rate and amount untouched. The
   * column default is the whole migration.
   */
  @test()
  @timeout(20000)
  async historicalInvoiceRow_readsAsHourlyWithItsFiguresIntact() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const end = moment.utc().startOf('minute').subtract(1, 'hour')
    const [row] = await App.conn.query(
      `INSERT INTO invoice ("projectId", "userId", "fromAt", "toAt", "amountCents", "state", "rateHourCents", "minutesActive", "snapshotVersion", "currency", "lines")
       VALUES ($1, $2, $3, $4, 3000, 'REQUESTED', 2000, 90, 1, 'USD', '[]'::jsonb)
       RETURNING id`,
      [
        project.id,
        owner.id,
        end.clone().subtract(90, 'minutes').toDate(),
        end.toDate(),
      ],
    )

    const read = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: row.id as never },
      headers: this.auth(owner),
      throwOnError: true,
    })

    expect(read.data.basis).to.be.eq(EInvoiceBasis.HOURLY)
    expect(read.data.milestoneRef ?? null).to.be.eq(null)
    expect(read.data.description ?? null).to.be.eq(null)
    expect(Number(read.data.amountCents)).to.be.eq(3000)
    expect(read.data.report?.rateHour).to.be.eq(20)
    expect(read.data.report?.minutesActive).to.be.eq(90)
  }

  /** The milestone is the hired worker's to bill; the client is the payer. */
  @test()
  @timeout(20000)
  async milestone_refusesTheClientAsIssuer() {
    const { client, project } = await this.hired()

    const pushed = await this.post(
      this.body({
        contractId: project.marketplaceContractId,
        freelancerId: client.id,
      }),
    )

    expect(pushed.status).to.be.eq(403)
  }

  /** Somebody neither hired nor paying cannot be made to bill either. */
  @test()
  @timeout(20000)
  async milestone_refusesAStrangerAsIssuer() {
    const { project } = await this.hired()
    const stranger = await this.userFixture.createUser()

    const pushed = await this.post(
      this.body({
        contractId: project.marketplaceContractId,
        freelancerId: stranger.id,
      }),
    )

    expect(pushed.status).to.be.eq(403)
  }

  /**
   * A contract with no project here, or a freelancer this instance has never
   * seen, means the two services are pointed at different deployments. A 409
   * says so; a 200 with no invoice would hide it.
   */
  @test()
  @timeout(20000)
  async milestone_refusesAnUnknownContractOrFreelancer() {
    const { freelancer, project } = await this.hired()

    const unknownContract = await this.post(
      this.body({ freelancerId: freelancer.id }),
    )
    const unknownFreelancer = await this.post(
      this.body({ contractId: project.marketplaceContractId }),
    )

    expect(unknownContract.status).to.be.eq(409)
    expect(unknownFreelancer.status).to.be.eq(409)
  }

  /** A sum has to be a positive whole number of cents, and a period a period. */
  @test()
  @timeout(20000)
  async milestone_refusesAnImpossibleBill() {
    const { freelancer, project } = await this.hired()
    const base = {
      contractId: project.marketplaceContractId,
      freelancerId: freelancer.id,
    }

    for (const override of [
      { amountCents: 0 },
      { amountCents: -100 },
      { amountCents: 1.5 },
      // Past what the integer column holds: a 400 here, not a 500 from the
      // insert.
      { amountCents: 2147483648 },
      { description: '' },
    ]) {
      const pushed = await this.post(this.body({ ...base, ...override }))

      expect(pushed.status, JSON.stringify(override)).to.be.eq(400)
    }

    const end = moment.utc().startOf('minute').unix()
    const backwards = await this.post(
      this.body({ ...base, workStart: end, workEnd: end }),
    )

    expect(backwards.status).to.be.eq(400)
  }

  /** The same guard the hire and the end have, under this call's own header. */
  @test()
  @timeout(20000)
  async milestone_rejectsBadSignatureStaleCallsAndReplays() {
    const { freelancer, project } = await this.hired()
    const base = {
      contractId: project.marketplaceContractId,
      freelancerId: freelancer.id,
    }

    const forged = await this.post(this.body(base), 'deadbeef')

    expect(forged.status).to.be.eq(401)

    const stale = await this.post(
      this.body({ ...base, issuedAt: Math.floor(Date.now() / 1000) - 86400 }),
    )

    expect(stale.status).to.be.eq(401)

    const body = this.body(base)
    const first = await this.post(body)
    const replay = await this.post(body)

    expect(first.status).to.be.eq(200)
    expect(replay.status).to.be.eq(401)
  }

  /** A hire's signature is not a bill's: the headers are not interchangeable. */
  @test()
  @timeout(20000)
  async milestone_refusesASignatureSentInTheHiresHeader() {
    const { freelancer, project } = await this.hired()
    const body = this.body({
      contractId: project.marketplaceContractId,
      freelancerId: freelancer.id,
    })
    const raw = JSON.stringify(body)

    const sent = await axios.post(
      `${this.url}/api/internal/marketplace/milestone-invoice`,
      raw,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Marketplace-Signature': this.signature.sign(
            InternalRoute.HIRE,
            raw,
          ),
        },
        validateStatus: () => true,
      },
    )

    expect(sent.status).to.be.eq(401)
  }
}

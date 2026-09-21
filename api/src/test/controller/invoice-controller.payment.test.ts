import { expect } from 'chai'
import axios from 'axios'
import { faker } from '@faker-js/faker'
import moment from 'moment'
import { suite, test, timeout } from '@testdeck/mocha'
import {
  invoiceControllerCreate,
  invoiceControllerMarkPaid,
  invoiceControllerMarkUnpaid,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { EInvoiceSettlementKind, EInvoiceState } from '@/model/invoice'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'

type Mark = typeof invoiceControllerMarkPaid

/**
 * `POST /invoice/:id/paid` and `/unpaid` over HTTP: who may press them, what
 * they answer, and what they change.
 *
 * The rule is the issuer's alone - the person owed the money is the one who
 * knows whether it arrived. The project owner reads the invoice and pays it,
 * but cannot certify their own payment; anyone else cannot read it at all.
 * Every refusal must leave the invoice and its hours exactly as they were.
 *
 * Each test declares a 20s budget. They are HTTP round trips that finish in
 * well under a second alone, and went past mocha's 2s default - a single
 * unauthenticated request included - when other suites shared the machine.
 * A budget only ever makes a test less likely to fail.
 */
@suite()
export class InvoiceControllerPaymentTest extends BaseControllerTest {
  protected invoiceRepository: InvoiceRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.timeRepository = this.container.get('TimeRepository')
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  /**
   * A worker hired on a client's project, one hour tracked and invoiced by
   * the worker through the API - so the invoice is linked to its entry as a
   * real one is.
   */
  private async issued(): Promise<{
    client: User
    worker: User
    project: Project
    invoiceId: string
    time: Time
  }> {
    const client = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createHired(client, worker, 30)
    // One instant, both ends derived from it.
    const start = moment.utc().startOf('minute').subtract(2, 'hours')
    const time = await this.timeFixture.create(
      project,
      start.toDate(),
      start.clone().add(1, 'hour').toDate(),
      worker,
    )

    time.minutesActive = 60
    await runPromise(this.timeRepository.saveSingle(time))

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(worker),
      body: {},
      throwOnError: true,
    })

    return {
      client,
      worker,
      project,
      invoiceId: created.data.id as string,
      time,
    }
  }

  /**
   * The generated client's call, answering with the status whatever it is:
   * a refusal is the result under test here, not an exception to catch.
   */
  private async call(
    mark: Mark,
    invoiceId: string,
    user?: User,
  ): Promise<{
    status: number
    data?: { state?: string; paidAt?: string | null; settlementKind?: string }
  }> {
    try {
      const response = await mark({
        client: this.apiClient(),
        path: { id: invoiceId as never },
        headers: user ? this.auth(user) : undefined,
        throwOnError: true,
      })

      return { status: response.status, data: response.data }
    } catch (error: unknown) {
      if (!axios.isAxiosError(error) || !error.response) {
        throw error
      }

      return { status: error.response.status }
    }
  }

  private async state(invoiceId: string, time: Time) {
    const invoice = await runPromise(
      this.invoiceRepository.findOneBy({ where: { id: invoiceId } }),
    )
    const entry = await runPromise(
      this.timeRepository.findOneBy({ where: { id: time.id } }),
    )

    return {
      state: invoice?.state,
      paidAt: invoice?.paidAt ?? null,
      settlementKind: invoice?.settlementKind ?? null,
      isPaid: Boolean(entry?.isPaid),
    }
  }

  /** 200 for the issuer, both ways, with the hours following the invoice. */
  @test()
  @timeout(20000)
  async issuer_marksPaidAndBack() {
    const { worker, invoiceId, time } = await this.issued()

    const paid = await this.call(invoiceControllerMarkPaid, invoiceId, worker)

    expect(paid.status).to.be.eq(200)
    expect(paid.data?.state).to.be.eq(EInvoiceState.PAID)
    expect(paid.data?.settlementKind).to.be.eq(EInvoiceSettlementKind.MANUAL)
    expect(paid.data?.paidAt).to.be.a('string')
    expect(await this.state(invoiceId, time)).to.deep.include({
      state: EInvoiceState.PAID,
      settlementKind: EInvoiceSettlementKind.MANUAL,
      isPaid: true,
    })

    const unpaid = await this.call(
      invoiceControllerMarkUnpaid,
      invoiceId,
      worker,
    )

    expect(unpaid.status).to.be.eq(200)
    expect(unpaid.data?.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(await this.state(invoiceId, time)).to.deep.eq({
      state: EInvoiceState.REQUESTED,
      paidAt: null,
      settlementKind: null,
      isPaid: false,
    })
  }

  /** Pressing it twice is not an error and changes nothing more. */
  @test()
  @timeout(20000)
  async issuer_markingTwice_isIdempotent() {
    const { worker, invoiceId, time } = await this.issued()

    await this.call(invoiceControllerMarkPaid, invoiceId, worker)
    const first = await this.state(invoiceId, time)
    const again = await this.call(invoiceControllerMarkPaid, invoiceId, worker)

    expect(again.status).to.be.eq(200)
    expect(await this.state(invoiceId, time)).to.deep.eq(first)
  }

  /**
   * 403 for the project owner - who reads the invoice and pays it, but may
   * not certify that they did - and for anyone else. Nothing changes.
   */
  @test()
  @timeout(20000)
  async nonIssuer_isRefusedAndChangesNothing() {
    const { client, worker, invoiceId, time } = await this.issued()
    const stranger = await this.userFixture.createUser()
    const before = await this.state(invoiceId, time)

    for (const user of [client, stranger]) {
      const paid = await this.call(invoiceControllerMarkPaid, invoiceId, user)

      expect(paid.status, 'paid').to.be.eq(403)
      expect(await this.state(invoiceId, time)).to.deep.eq(before)
    }

    await this.call(invoiceControllerMarkPaid, invoiceId, worker)
    const settled = await this.state(invoiceId, time)

    for (const user of [client, stranger]) {
      const unpaid = await this.call(
        invoiceControllerMarkUnpaid,
        invoiceId,
        user,
      )

      expect(unpaid.status, 'unpaid').to.be.eq(403)
      expect(await this.state(invoiceId, time)).to.deep.eq(settled)
    }
  }

  /** 404 for an id no invoice has, either way. */
  @test()
  @timeout(20000)
  async unknownInvoice_isNotFound() {
    const user = await this.userFixture.createUser()
    const unknown = faker.string.uuid()

    for (const mark of [
      invoiceControllerMarkPaid,
      invoiceControllerMarkUnpaid,
    ]) {
      const response = await this.call(mark, unknown, user)

      expect(response.status).to.be.eq(404)
    }
  }

  /** 401 without a session, before anything else is looked at. */
  @test()
  @timeout(20000)
  async anonymous_isUnauthorized() {
    const { invoiceId, time } = await this.issued()
    const before = await this.state(invoiceId, time)

    for (const mark of [
      invoiceControllerMarkPaid,
      invoiceControllerMarkUnpaid,
    ]) {
      const response = await this.call(mark, invoiceId)

      expect(response.status).to.be.eq(401)
    }

    expect(await this.state(invoiceId, time)).to.deep.eq(before)
  }
}

import { expect } from 'chai'
import axios from 'axios'
import { faker } from '@faker-js/faker'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { invoiceControllerCreate, invoiceControllerRead } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EProjectState } from '@/model/project'
import { EInvoiceState } from '@/model/invoice'

@suite()
export class InvoiceControllerTest extends BaseControllerTest {
  @test()
  async read_invoiceOwnedByCurrentUser() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const invoice = await this.invoiceFixture.create(
      project,
      50,
      EInvoiceState.PAID,
    )

    const client = this.apiClient()
    const res = await invoiceControllerRead({
      client,
      path: { id: invoice.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const responseInvoice = res.data as {
      id?: string
      amountCents?: number
      state?: EInvoiceState
      fromAt?: string
      toAt?: string
      project?: { id?: string; title?: string; state?: EProjectState }
    }
    expect(responseInvoice.id).to.be.equal(invoice.id)
    expect(responseInvoice.amountCents).to.be.equal(invoice.amountCents)
    expect(responseInvoice.state).to.be.equal(invoice.state)
    expect(
      new Date(responseInvoice.fromAt as string).toISOString(),
    ).to.be.equal(invoice.fromAt.toISOString())
    expect(new Date(responseInvoice.toAt as string).toISOString()).to.be.equal(
      invoice.toAt.toISOString(),
    )
    const responseProject = responseInvoice.project ?? {}
    expect(responseProject.id).to.be.equal(project.id)
    expect(responseProject.title).to.be.equal(project.title)
    expect(responseProject.state).to.be.equal(project.state)
  }

  @test()
  async read_requiresAuthorization() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const invoice = await this.invoiceFixture.create(
      project,
      50,
      EInvoiceState.PAID,
    )

    let error: unknown

    try {
      await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: invoice.id as never },
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
  async read_deniedForNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const invoice = await this.invoiceFixture.create(
      project,
      50,
      EInvoiceState.PAID,
    )

    let error: unknown

    try {
      await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: invoice.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(403)
  }

  @test()
  async read_unknownInvoice_notFound() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: faker.string.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(404)
  }

  /**
   * The read is the whole invoice page: the record, the entries it bills, and
   * their roll-up. It used to take three requests, and the breakdown came from
   * a project-wide report - so an invoice listed hours it did not charge for.
   */
  @test()
  async read_carriesTheTimeItBills() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    // One instant for both ends: two separate clock reads can straddle a
    // millisecond tick, and the ten-minute span then reports 10.0000167.
    const now = moment.utc()
    const billed = await this.timeFixture.create(
      project,
      now.clone().subtract(2, 'hours').toDate(),
      now.clone().subtract(110, 'minutes').toDate(),
    )

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {},
      throwOnError: true,
    })

    const res = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: created.data.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.time).to.have.length(1)
    expect(res.data.time?.[0]?.id).to.be.equal(billed.id)
    expect(res.data.report?.rateHour).to.be.equal(60)
    expect(res.data.report?.minutes).to.be.equal(10)
    expect(res.data.report?.minutesActive).to.be.equal(billed.minutesActive)
    expect(res.data.report?.minutesUnpaid).to.be.equal(billed.minutesActive)
    expect(res.data.report?.minutesPaid).to.be.equal(0)
  }

  /**
   * Hours tracked after the invoice was raised belong to the next one. The
   * project-wide report this replaced pulled them in, so the line items grew
   * every time anyone kept working while the total stayed frozen.
   */
  @test()
  async read_excludesTimeOnNoInvoiceOfItsOwn() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const billed = await this.timeFixture.create(
      project,
      moment.utc().subtract(2, 'hours').toDate(),
      moment.utc().subtract(110, 'minutes').toDate(),
    )

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {},
      throwOnError: true,
    })

    await this.timeFixture.create(
      project,
      moment.utc().subtract(30, 'minutes').toDate(),
      moment.utc().subtract(20, 'minutes').toDate(),
    )

    const res = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: created.data.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.data.time).to.have.length(1)
    expect(res.data.time?.[0]?.id).to.be.equal(billed.id)
  }

  /** An invoice with nothing linked reports zeroes, not a missing report. */
  @test()
  async read_withoutLinkedTime_reportsZero() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const invoice = await this.invoiceFixture.create(
      project,
      50,
      EInvoiceState.REQUESTED,
    )

    const res = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: invoice.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.data.time).to.have.length(0)
    expect(res.data.report?.minutes).to.be.equal(0)
    expect(res.data.report?.minutesActive).to.be.equal(0)
  }
}

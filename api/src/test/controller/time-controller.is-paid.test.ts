import { expect } from 'chai'
import { faker } from '@faker-js/faker'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import {
  projectControllerEdit,
  timeControllerCreateOrUpdateMany,
  timeControllerEdit,
  timeControllerMarkPaid,
  timeControllerMarkUnpaid,
  timeControllerSearch,
} from '@app/api-client'
import type { TimeCreateDto as ApiTimeCreateDto } from '@app/api-client'

import { App } from '@/app/app'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { TimeRepository } from '@/repository/time-repository'
import { InvoiceManager } from '@/service/invoice-manager'
import { EInvoiceState } from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class TimeControllerIsPaidTest extends BaseControllerTest {
  protected timeRepository: TimeRepository
  protected invoiceManager: InvoiceManager

  constructor() {
    super()

    this.timeRepository = this.container.get('TimeRepository')
    this.invoiceManager = this.container.get('InvoiceManager')
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
        body: { ids: [faker.string.uuid()] },
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

    const updatedFirst = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: first.id },
      }),
    )
    const updatedSecond = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: second.id },
      }),
    )

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
    await runPromise(this.timeRepository.saveSingle(time))

    const res = await timeControllerMarkUnpaid({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: { ids: [time.id] },
      throwOnError: true,
    })

    const updated = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )

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
    expect(error.response?.status).to.be.equal(403)

    const unchanged = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: timeId },
      }),
    )
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

    const updated = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: timeId },
      }),
    )

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
    expect(error.response?.status).to.be.equal(403)

    const unchanged = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
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
    expect(error.response?.status).to.be.equal(403)

    const unchanged = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
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
        body: { ids: [faker.string.uuid()] },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)
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

  /**
   * Two of the owner's entries, from one instant, with the first on an
   * invoice of its own and the second on none.
   */
  private async oneInvoicedOneNot() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const now = moment.utc()
    const invoiced = await this.timeFixture.create(
      project,
      now.clone().subtract(120, 'minutes').toDate(),
      now.clone().subtract(90, 'minutes').toDate(),
    )
    const free = await this.timeFixture.create(
      project,
      now.clone().subtract(60, 'minutes').toDate(),
      now.toDate(),
    )
    const invoice = await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [invoiced.id]),
    )

    return { owner, project, invoiced, free, invoice }
  }

  private async reload(time: Time): Promise<Time> {
    return runPromise(this.timeRepository.findOneByIdOrFail(time.id))
  }

  private async rejectionOf(call: () => Promise<unknown>) {
    try {
      await call()
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        return error
      }

      throw error
    }

    throw new Error('Expected the request to be refused')
  }

  /**
   * G4. An invoiced entry's isPaid is its invoice's: flipping it by hand used
   * to leave a PAID invoice owning unpaid hours. Refused with a 409 that
   * names the invoice, and nothing moves - not the entry, not the invoice.
   */
  @test()
  async markUnpaid_onAnEntryOfAPaidInvoice_is409AndChangesNothing() {
    const { owner, invoiced, invoice } = await this.oneInvoicedOneNot()
    await runPromise(this.invoiceManager.markPaid(invoice, owner))

    const error = await this.rejectionOf(() =>
      timeControllerMarkUnpaid({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: { ids: [invoiced.id] },
        throwOnError: true,
      }),
    )

    expect(error.response?.status).to.be.equal(409)
    expect(error.response?.data.name).to.be.equal('InvoicedTimeException')
    expect(error.response?.data.message).to.contain(invoice.id)

    const stored = await App.conn
      .getRepository(Invoice)
      .findOneByOrFail({ id: invoice.id })
    const lines = await runPromise(this.timeRepository.findForInvoice(invoice))

    expect(stored.state).to.be.equal(EInvoiceState.PAID)
    expect(lines).to.have.length(1)
    expect(lines.every((time) => time.isPaid)).to.be.true
  }

  /** And a REQUESTED invoice must not come to own hours marked paid. */
  @test()
  async markPaid_onAnEntryOfARequestedInvoice_is409() {
    const { owner, invoiced } = await this.oneInvoicedOneNot()

    const error = await this.rejectionOf(() =>
      timeControllerMarkPaid({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: { ids: [invoiced.id] },
        throwOnError: true,
      }),
    )

    expect(error.response?.status).to.be.equal(409)
    expect((await this.reload(invoiced)).isPaid).to.be.false
  }

  /** A bulk action never half-applies: one invoiced entry refuses them all. */
  @test()
  async markPaid_withOneInvoicedEntry_refusesTheWholeRequest() {
    const { owner, invoiced, free } = await this.oneInvoicedOneNot()

    const error = await this.rejectionOf(() =>
      timeControllerMarkPaid({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: { ids: [invoiced.id, free.id] },
        throwOnError: true,
      }),
    )

    expect(error.response?.status).to.be.equal(409)
    expect((await this.reload(invoiced)).isPaid).to.be.false
    expect((await this.reload(free)).isPaid).to.be.false
  }

  /** Entries no invoice covers toggle exactly as before. */
  @test()
  async markPaid_onAnUninvoicedEntry_stillTogglesBesideAnInvoice() {
    const { owner, free } = await this.oneInvoicedOneNot()
    const headers = {
      Authorization: this.authenticator.getTokens(owner).accessToken,
    }

    await timeControllerMarkPaid({
      client: this.apiClient(),
      headers,
      body: { ids: [free.id] },
      throwOnError: true,
    })
    expect((await this.reload(free)).isPaid).to.be.true

    await timeControllerMarkUnpaid({
      client: this.apiClient(),
      headers,
      body: { ids: [free.id] },
      throwOnError: true,
    })
    expect((await this.reload(free)).isPaid).to.be.false
  }

  /** The row edit is the third way in, and is refused the same way. */
  @test()
  async edit_changingIsPaidOnAnInvoicedEntry_is409AndChangesNothing() {
    const { owner, invoiced } = await this.oneInvoicedOneNot()

    const error = await this.rejectionOf(() =>
      timeControllerEdit({
        client: this.apiClient(),
        path: { id: invoiced.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: { note: 'changed', isPaid: true },
        throwOnError: true,
      }),
    )

    expect(error.response?.status).to.be.equal(409)

    const stored = await this.reload(invoiced)
    expect(stored.isPaid).to.be.false
    expect(stored.note).to.be.equal(invoiced.note)
  }

  /**
   * The time dialog sends isPaid with every save. Sending the value the entry
   * already has is not a change, so an invoiced entry's note stays editable.
   */
  @test()
  async edit_keepingIsPaidOnAnInvoicedEntry_savesTheNote() {
    const { owner, invoiced } = await this.oneInvoicedOneNot()

    await timeControllerEdit({
      client: this.apiClient(),
      path: { id: invoiced.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: { note: 'still editable', isPaid: false },
      throwOnError: true,
    })

    const stored = await this.reload(invoiced)
    expect(stored.note).to.be.equal('still editable')
    expect(stored.isPaid).to.be.false
  }

  /**
   * The table needs to know which entries an invoice covers to disable their
   * paid toggle, so the search carries the invoice id - read-only.
   */
  @test()
  async search_carriesTheInvoiceOfEachEntry() {
    const { owner, project, invoiced, free, invoice } =
      await this.oneInvoicedOneNot()

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: { filter: { projectId: project.id }, sort: {}, page: 0 },
      throwOnError: true,
    })

    const [rows] = res.data as unknown as [
      { id: string; invoiceId?: string | null }[],
      number,
    ]
    const byId = new Map(rows.map((row) => [row.id, row.invoiceId]))

    expect(byId.get(invoiced.id)).to.be.equal(invoice.id)
    expect(byId.get(free.id) ?? null).to.be.null
  }
}

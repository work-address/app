import { expect } from 'chai'
import axios from 'axios'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import {
  invoiceControllerCreate,
  invoiceControllerRead,
  invoiceControllerRecord,
  projectControllerEdit,
  timeControllerCreateOrUpdateMany,
  timeControllerRemoveProcesses,
  timeControllerRemoveScreenshots,
} from '@app/api-client'
import type { TimeCreateDto as ApiTimeCreateDto } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import {
  EInvoiceCurrency,
  EInvoiceSnapshotVersion,
  EInvoiceState,
} from '@/model/invoice'
import { InvoiceRecord } from '@/service/invoice-record'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'

/**
 * DEC-04: an issued invoice keeps its own financial breakdown. What it billed
 * - rate, minutes, lines, amount - is frozen in the same write as the amount,
 * and nothing done to the project or the entries afterwards changes it.
 */
@suite()
export class InvoiceControllerSnapshotTest extends BaseControllerTest {
  protected invoiceRepository: InvoiceRepository
  protected projectRepository: ProjectRepository
  protected timeRepository: TimeRepository
  protected invoiceRecord: InvoiceRecord

  constructor() {
    super()

    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeRepository = this.container.get('TimeRepository')
    this.invoiceRecord = this.container.get('InvoiceRecord')
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  /**
   * Three half-hour entries with 30 active minutes each - 90 active minutes -
   * ending an hour ago. One clock read for every bound, so the spans are
   * exact.
   */
  private async ninetyActiveMinutes(
    project: Project,
    author: User,
  ): Promise<Time[]> {
    const start = moment.utc().startOf('minute').subtract(150, 'minutes')
    const times: Time[] = []

    for (const offset of [0, 30, 60]) {
      const time = await this.timeFixture.create(
        project,
        start.clone().add(offset, 'minutes').toDate(),
        start
          .clone()
          .add(offset + 30, 'minutes')
          .toDate(),
        author,
      )

      time.minutesActive = 30
      times.push(await runPromise(this.timeRepository.saveSingle(time)))
    }

    return times
  }

  private async stored(id: string): Promise<Invoice> {
    const invoice = await runPromise(
      this.invoiceRepository.findOneBy({
        where: { id },
        relations: { project: true, user: true },
      }),
    )

    return invoice!
  }

  private async setRate(owner: User, project: Project, rateHour: string) {
    await projectControllerEdit({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: this.auth(owner),
      body: {
        title: project.title,
        text: project.text,
        state: project.state,
        rateHour,
      },
      throwOnError: true,
    })

    const edited = await runPromise(
      this.projectRepository.findOneBy({ where: { id: project.id } }),
    )

    // Guard the premise: a rate edit that silently did nothing would make
    // every "unchanged" assertion below pass for the wrong reason.
    expect(Number(edited!.rateHour)).to.be.eq(Number(rateHour))
  }

  /**
   * The acceptance case: issued at $20/h, then the project goes to $50/h.
   * The invoice still says $20, the same lines and 3000 cents.
   */
  @test()
  async rateChangeAfterIssue_leavesTheInvoiceAsIssued() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const times = await this.ninetyActiveMinutes(project, owner)

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(owner),
      body: {},
      throwOnError: true,
    })

    expect(Number(created.data.amountCents)).to.be.eq(3000)

    const before = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: created.data.id as never },
      headers: this.auth(owner),
      throwOnError: true,
    })

    await this.setRate(owner, project, '50.00')

    const after = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: created.data.id as never },
      headers: this.auth(owner),
      throwOnError: true,
    })

    expect(after.data.report?.rateHour).to.be.eq(20)
    expect(after.data.report?.rateTotal).to.be.eq(30)
    expect(after.data.report?.minutesActive).to.be.eq(90)
    expect(Number(after.data.amountCents)).to.be.eq(3000)
    expect(after.data.lines).to.deep.eq(before.data.lines)
    expect(after.data.lines?.map((line) => line.timeId)).to.deep.eq(
      times.map((time) => time.id),
    )
    expect(after.data.lines?.map((line) => line.minutesActive)).to.deep.eq([
      30, 30, 30,
    ])
    expect(after.data.rateHourCents).to.be.eq(2000)
  }

  /**
   * Every way of raising an invoice writes the whole snapshot with the
   * amount, and the amount is the snapshot's own arithmetic. The selection
   * here is a worker's, so issuer and counterparty are different wallets.
   */
  @test()
  async everyCreationMode_persistsTheSnapshotWithTheAmount() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)

    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const start = moment.utc().startOf('minute').subtract(10, 'hours')
    const entry = async (hour: number, author: User, minutesActive = 45) => {
      const time = await this.timeFixture.create(
        project,
        start.clone().add(hour, 'hours').toDate(),
        start.clone().add(hour, 'hours').add(50, 'minutes').toDate(),
        author,
      )

      time.minutesActive = minutesActive

      return runPromise(this.timeRepository.saveSingle(time))
    }

    const ranged = await entry(0, owner)
    const selected = await entry(2, worker, 7)
    const outstanding = await entry(4, owner)

    const byRange = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(owner),
      body: {
        fromUnix: start.valueOf(),
        toUnix: start.clone().add(1, 'hour').valueOf(),
      },
      throwOnError: true,
    })
    const bySelection = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(worker),
      body: { timeIds: [selected.id] },
      throwOnError: true,
    })
    const byEnsure = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(owner),
      body: {},
      throwOnError: true,
    })

    const cases: [string | undefined, User, Time, number][] = [
      // 45 minutes at 2000 cents an hour: 1500.
      [byRange.data.id, owner, ranged, 1500],
      // 7 minutes: 233.33 rounds to 233.
      [bySelection.data.id, worker, selected, 233],
      [byEnsure.data.id, owner, outstanding, 1500],
    ]

    for (const [id, issuer, time, amountCents] of cases) {
      const invoice = await this.stored(id!)

      expect(invoice.snapshotVersion).to.be.eq(EInvoiceSnapshotVersion.V1)
      expect(invoice.user?.id).to.be.eq(issuer.id)
      expect(invoice.issuerAddress).to.be.eq(
        WalletAddress.toCanonical(issuer.address),
      )
      expect(invoice.ownerAddress).to.be.eq(
        WalletAddress.toCanonical(owner.address),
      )
      expect(invoice.currency).to.be.eq(EInvoiceCurrency.USD)
      expect(invoice.rateHourCents).to.be.eq(2000)
      expect(invoice.minutesActive).to.be.eq(time.minutesActive)
      expect(invoice.amountCents).to.be.eq(amountCents)
      expect(invoice.lines).to.deep.eq([
        {
          timeId: time.id,
          fromAt: new Date(time.fromAt).toISOString(),
          toAt: new Date(time.toAt).toISOString(),
          minutesActive: time.minutesActive,
        },
      ])
    }
  }

  /**
   * The entries are evidence and may change after issuance: a tracker
   * re-sync rewrites an entry's activity, and screenshots and processes can
   * be cleared. None of it reaches what the invoice billed.
   */
  @test()
  async resyncAndMediaRemoval_leaveTheSnapshotAlone() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const end = moment.utc().startOf('minute').subtract(1, 'hour')
    const entry = (minutesActive: number): ApiTimeCreateDto => ({
      fromIndex: 1000,
      toIndex: 1001,
      note: 'tracked',
      keyboardKeys: 1,
      minutesActive,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: end.clone().subtract(10, 'minutes').toISOString(),
      toAt: end.toISOString(),
      projectId: project.id,
    })

    const synced = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: this.auth(owner),
      body: [entry(9)],
      throwOnError: true,
    })
    const timeId = (synced.data[0] as { id: string }).id

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(owner),
      body: {},
      throwOnError: true,
    })

    await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: this.auth(owner),
      body: [entry(2)],
      throwOnError: true,
    })
    await timeControllerRemoveScreenshots({
      client: this.apiClient(),
      headers: this.auth(owner),
      body: { ids: [timeId] },
      throwOnError: true,
    })
    await timeControllerRemoveProcesses({
      client: this.apiClient(),
      headers: this.auth(owner),
      body: { ids: [timeId] },
      throwOnError: true,
    })

    const read = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: created.data.id as never },
      headers: this.auth(owner),
      throwOnError: true,
    })

    // The re-sync really did rewrite the entry...
    expect(read.data.time?.[0]?.minutesActive).to.be.eq(2)
    // ...and the invoice still bills what it billed.
    expect(read.data.lines?.[0]?.minutesActive).to.be.eq(9)
    expect(read.data.report?.minutesActive).to.be.eq(9)
    expect(read.data.report?.minutesUnpaid).to.be.eq(9)
    expect(Number(read.data.amountCents)).to.be.eq(300)
  }

  /**
   * GET /invoice/:id/record is the snapshot's InvoiceRecord v1, the document
   * an escrow commitment hashes, for the issuer and the owner alike.
   */
  @test()
  async record_isTheCanonicalRecordOfTheSnapshot() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)

    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const times = await this.ninetyActiveMinutes(project, worker)
    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(worker),
      body: {},
      throwOnError: true,
    })

    await this.setRate(owner, project, '50.00')

    const expected = JSON.parse(
      this.invoiceRecord.serialise(await this.stored(created.data.id!)),
    )

    for (const reader of [worker, owner]) {
      const res = await invoiceControllerRecord({
        client: this.apiClient(),
        path: { id: created.data.id as never },
        headers: this.auth(reader),
        throwOnError: true,
      })

      expect(res.data).to.deep.eq(expected)
    }

    expect(expected).to.deep.include({
      version: 1,
      invoiceId: created.data.id,
      projectId: project.id,
      issuerId: worker.id,
      issuerAddress: WalletAddress.toCanonical(worker.address),
      ownerAddress: WalletAddress.toCanonical(owner.address),
      currency: 'USD',
      rateHourCents: 2000,
      minutesActive: 90,
      amountCents: 3000,
    })
    expect(
      expected.lines.map((line: { timeId: string }) => line.timeId),
    ).to.deep.eq(times.map((time) => time.id))
  }

  /** The record is the invoice's, and follows the invoice's own access. */
  @test()
  async record_isRefusedToAnyoneWhoCannotReadTheInvoice() {
    const owner = await this.userFixture.createUser()
    const outsider = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)

    await this.ninetyActiveMinutes(project, owner)

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(owner),
      body: {},
      throwOnError: true,
    })

    let status: number | undefined

    try {
      await invoiceControllerRecord({
        client: this.apiClient(),
        path: { id: created.data.id as never },
        headers: this.auth(outsider),
        throwOnError: true,
      })
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        throw error
      }

      status = error.response?.status
    }

    expect(status).to.be.eq(403)
  }

  /**
   * An invoice issued before snapshots never recorded its rate: it has no
   * record (409), and its page reports no rate rather than today's.
   */
  @test()
  async legacyInvoice_hasNoRecordAndReportsNoRate() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const legacy = await this.invoiceFixture.create(
      project,
      5000,
      EInvoiceState.REQUESTED,
    )
    // One instant, both ends derived from it: the minutes asserted below
    // must not depend on the clock moving between two reads.
    const now = moment.utc()
    const time = await this.timeFixture.create(
      project,
      now.clone().subtract(3, 'hours').toDate(),
      now.clone().subtract(2, 'hours').toDate(),
    )

    await runPromise(this.timeRepository.claimForInvoice(legacy, [time]))

    let status: number | undefined
    let message: string | undefined

    try {
      await invoiceControllerRecord({
        client: this.apiClient(),
        path: { id: legacy.id as never },
        headers: this.auth(owner),
        throwOnError: true,
      })
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        throw error
      }

      status = error.response?.status
      message = error.response?.data?.message
    }

    expect(status).to.be.eq(409)
    expect(message).to.contain(legacy.id)

    const read = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: legacy.id as never },
      headers: this.auth(owner),
      throwOnError: true,
    })

    expect(read.data.report?.rateHour).to.be.null
    expect(read.data.report?.rateTotal).to.be.null
    expect(read.data.report?.minutesActive).to.be.eq(time.minutesActive)
    expect(read.data.lines ?? null).to.be.null
    expect(Number(read.data.amountCents)).to.be.eq(5000)
  }

  /**
   * Marking paid and unpaid saves the invoice row again; no later save of it,
   * whatever the in-memory copy holds, can rewrite what it billed.
   */
  @test()
  async laterSave_cannotRewriteWhatWasBilled() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)

    await this.ninetyActiveMinutes(project, owner)

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(owner),
      body: {},
      throwOnError: true,
    })
    const invoice = await this.stored(created.data.id!)

    // An in-memory change reaching a later save must not reach the row.
    invoice.amountCents = 1
    invoice.rateHourCents = 1
    invoice.lines = []
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    const reread = await this.stored(created.data.id!)

    expect(reread.amountCents).to.be.eq(3000)
    expect(reread.rateHourCents).to.be.eq(2000)
    expect(reread.lines).to.have.length(3)
  }
}

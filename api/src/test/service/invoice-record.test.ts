import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'

import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import {
  EInvoiceBasis,
  EInvoiceCurrency,
  EInvoiceSnapshotVersion,
  EInvoiceState,
  IInvoiceLine,
} from '@/model/invoice'
import { InvoiceRecord } from '@/service/invoice-record'
import IncompleteInvoiceSnapshotException from '@/exception/incomplete-invoice-snapshot-exception'
import LegacyInvoiceException from '@/exception/legacy-invoice-exception'

type Snapshot = {
  id: string
  projectId: string
  issuerId: string
  issuerAddress: string
  ownerAddress: string
  currency: EInvoiceCurrency
  rateHourCents: number
  minutesActive: number
  amountCents: number
  fromAt: string
  toAt: string
  lines: IInvoiceLine[]
  basis?: EInvoiceBasis
  milestoneRef?: string
  description?: string
}

type Vector = { name: string; invoice: Snapshot; record: string }

/**
 * InvoiceRecord v1 is what an escrow invoice commitment hashes, so its bytes
 * are a published format rather than an implementation detail. The vectors in
 * `fixture/invoice-record.v1.json` were produced independently of this code
 * (a JCS encoder in another language), and every one must come out byte for
 * byte.
 */
@suite()
export class InvoiceRecordTest {
  private readonly service = new InvoiceRecord()

  private vectors(): Vector[] {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/invoice-record.v1.json'),
        'utf8',
      ),
    ).vectors
  }

  /** An Invoice entity carrying the vector's snapshot, as a read loads it. */
  private invoiceOf(snapshot: Snapshot): Invoice {
    const invoice = new Invoice()
    const project = new Project()
    const issuer = new User()

    project.id = snapshot.projectId
    issuer.id = snapshot.issuerId

    invoice.id = snapshot.id
    invoice.project = project
    invoice.user = issuer
    invoice.snapshotVersion = EInvoiceSnapshotVersion.V1
    invoice.issuerAddress = snapshot.issuerAddress
    invoice.ownerAddress = snapshot.ownerAddress
    invoice.currency = snapshot.currency
    invoice.rateHourCents = snapshot.rateHourCents
    invoice.minutesActive = snapshot.minutesActive
    invoice.amountCents = snapshot.amountCents
    invoice.fromAt = new Date(snapshot.fromAt)
    invoice.toAt = new Date(snapshot.toAt)
    invoice.lines = snapshot.lines.map((line) => ({ ...line }))
    invoice.state = EInvoiceState.REQUESTED
    // What a read loads: the column is never null, and every row before
    // FIXED existed defaulted to HOURLY.
    invoice.basis = snapshot.basis ?? EInvoiceBasis.HOURLY
    invoice.milestoneRef = snapshot.milestoneRef ?? null
    invoice.description = snapshot.description ?? null

    return invoice
  }

  private fixedVector(): Vector {
    const vector = this.vectors().find(
      (candidate) => candidate.invoice.basis === EInvoiceBasis.FIXED,
    )

    expect(vector, 'a FIXED vector').to.not.eq(undefined)

    return vector as Vector
  }

  @test()
  serialise_matchesEveryVectorByteForByte() {
    const vectors = this.vectors()

    expect(vectors).to.have.length.greaterThan(0)

    for (const vector of vectors) {
      expect(
        this.service.serialise(this.invoiceOf(vector.invoice)),
        vector.name,
      ).to.equal(vector.record)
    }
  }

  /** The 90-minute vector is the acceptance case: $20/h, 3000 cents. */
  @test()
  serialise_carriesTheWholeSnapshot() {
    const [vector] = this.vectors()
    const record = JSON.parse(vector.record)

    expect(record).to.deep.include({
      version: 1,
      invoiceId: vector.invoice.id,
      projectId: vector.invoice.projectId,
      issuerId: vector.invoice.issuerId,
      issuerAddress: vector.invoice.issuerAddress,
      ownerAddress: vector.invoice.ownerAddress,
      currency: 'USD',
      rateHourCents: 2000,
      minutesActive: 90,
      amountCents: 3000,
    })
    expect(record.lines.map((line: IInvoiceLine) => line.timeId)).to.deep.eq(
      vector.invoice.lines.map((line) => line.timeId),
    )
  }

  /**
   * The record is a property of the snapshot, not of whatever else is loaded
   * with it: today's project rate, the owner's current address, the paid
   * state and the order the lines were stored in change nothing.
   */
  @test()
  serialise_ignoresEverythingOutsideTheSnapshot() {
    const [vector] = this.vectors()
    const invoice = this.invoiceOf(vector.invoice)
    const owner = new User()

    owner.address = '0x0000000000000000000000000000000000000001'
    invoice.project.rateHour = 50
    invoice.project.user = owner
    invoice.state = EInvoiceState.PAID
    invoice.paidAt = new Date()
    invoice.lines = [...(invoice.lines ?? [])].reverse()

    expect(this.service.serialise(invoice)).to.equal(vector.record)
  }

  /** Any change to what was billed is a different record. */
  @test()
  serialise_changesWithEverySnapshotField() {
    const [vector] = this.vectors()
    const mutations: ((invoice: Invoice) => void)[] = [
      (invoice) => (invoice.id = '00000000-0000-4000-8000-000000000000'),
      (invoice) =>
        (invoice.project.id = '00000000-0000-4000-8000-000000000000'),
      (invoice) => (invoice.user!.id = '00000000-0000-4000-8000-000000000000'),
      (invoice) => (invoice.issuerAddress = `${invoice.issuerAddress}0`),
      (invoice) => (invoice.ownerAddress = `${invoice.ownerAddress}0`),
      (invoice) => (invoice.rateHourCents = 2001),
      (invoice) => (invoice.minutesActive = 91),
      (invoice) => (invoice.amountCents = 3001),
      (invoice) => (invoice.fromAt = new Date(invoice.fromAt.getTime() + 1)),
      (invoice) => (invoice.toAt = new Date(invoice.toAt.getTime() + 1)),
      (invoice) => (invoice.lines![0].minutesActive += 1),
      (invoice) => (invoice.lines![0].toAt = '2026-09-01T09:31:00.000Z'),
      (invoice) => invoice.lines!.pop(),
    ]

    for (const [index, mutate] of mutations.entries()) {
      const invoice = this.invoiceOf(vector.invoice)

      mutate(invoice)

      expect(this.service.serialise(invoice), `mutation ${index}`).not.to.equal(
        vector.record,
      )
    }
  }

  /**
   * A FIXED invoice has no lines and no rate, so its record says what the sum
   * is for - its basis, milestone and description - and a change to any of
   * them is a different record. An hourly record never carries those keys,
   * which is why the hourly vectors did not move when FIXED arrived.
   */
  @test()
  serialise_ofAFixedInvoiceCommitsToWhatItBillsFor() {
    const vector = this.fixedVector()
    const record = JSON.parse(vector.record)

    expect(record).to.deep.include({
      basis: 'FIXED',
      milestoneRef: vector.invoice.milestoneRef,
      description: vector.invoice.description,
      amountCents: 250000,
      rateHourCents: 0,
      minutesActive: 0,
      lines: [],
    })

    for (const mutate of [
      (invoice: Invoice) => (invoice.description = `${invoice.description}.`),
      (invoice: Invoice) => (invoice.milestoneRef = `${invoice.milestoneRef}0`),
      (invoice: Invoice) => (invoice.basis = EInvoiceBasis.HOURLY),
    ]) {
      const invoice = this.invoiceOf(vector.invoice)

      mutate(invoice)

      expect(this.service.serialise(invoice)).not.to.equal(vector.record)
    }

    const [hourly] = this.vectors()

    expect(Object.keys(JSON.parse(hourly.record))).to.not.include.members([
      'basis',
      'milestoneRef',
      'description',
    ])
  }

  /** A FIXED snapshot that lost what it bills for has no record. */
  @test()
  serialise_refusesAFixedSnapshotWithoutItsDescription() {
    const vector = this.fixedVector()

    for (const field of ['description', 'milestoneRef'] as const) {
      const invoice = this.invoiceOf(vector.invoice)

      invoice[field] = null

      expect(() => this.service.serialise(invoice))
        .to.throw(IncompleteInvoiceSnapshotException, field)
        .with.property('httpCode', 409)
    }
  }

  /**
   * A legacy invoice never recorded its rate or lines. It has no record, and
   * asking for one is refused (409) rather than answered from today's
   * project.
   */
  @test()
  serialise_refusesAnInvoiceWithoutASnapshot() {
    const [vector] = this.vectors()

    for (const version of [null, undefined, EInvoiceSnapshotVersion.LEGACY]) {
      const invoice = this.invoiceOf(vector.invoice)

      invoice.snapshotVersion = version

      expect(() => this.service.serialise(invoice))
        .to.throw(LegacyInvoiceException, vector.invoice.id)
        .with.property('httpCode', 409)
    }
  }

  @test()
  serialise_refusesASnapshotWithAFieldMissing() {
    const [vector] = this.vectors()
    const invoice = this.invoiceOf(vector.invoice)

    invoice.rateHourCents = null

    expect(() => this.service.serialise(invoice))
      .to.throw(IncompleteInvoiceSnapshotException, /rateHourCents/)
      .with.property('httpCode', 409)
  }

  /**
   * The issuer comes from the `user` relation, which is nullable for rows
   * older than issuers: a snapshot without one is refused as a conflict
   * naming the invoice, not a TypeError the API would answer with a 500.
   */
  @test()
  serialise_refusesASnapshotWithoutItsIssuer() {
    const [vector] = this.vectors()

    for (const user of [null, undefined]) {
      const invoice = this.invoiceOf(vector.invoice)

      invoice.user = user

      expect(() => this.service.serialise(invoice))
        .to.throw(IncompleteInvoiceSnapshotException, vector.invoice.id)
        .with.property('httpCode', 409)
      expect(() => this.service.serialise(invoice)).to.throw(/issuer/)
    }
  }
}

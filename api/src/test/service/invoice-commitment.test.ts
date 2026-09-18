import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as web3 from 'web3'

import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import {
  EInvoiceCurrency,
  EInvoiceSnapshotVersion,
  EInvoiceState,
  IInvoiceCommitmentBinding,
  IInvoiceRecord,
} from '@/model/invoice'
import { CanonicalJson } from '@/service/canonical-json'
import { InvoiceCommitment } from '@/service/invoice-commitment'
import { InvoiceRecord } from '@/service/invoice-record'

type Vector = IInvoiceCommitmentBinding & {
  name: string
  salt: string
  record: IInvoiceRecord
  document: string
  commitment: string
  amount: string
}

type Fixture = {
  domainTag: string
  domain: string
  vectors: Vector[]
  retired: { contractId: string }
}

/**
 * SHA-256 of `fixture/invoice-commitment.v1.json`. The contracts repository
 * keeps a byte-identical copy in `test/fixtures` and pins the same digest, so
 * neither copy can change without a failing test on its own side.
 */
const FIXTURE_SHA256 =
  '56ff82ddec4f82e7d46d898b0b8dbf0e04909a6cae2da77975f8f978a6a35a0d'

/**
 * InvoiceCommitment v1 is what a worker submits to MarketplaceEscrow, and a
 * verifier with the record and the salt must reproduce it without this code.
 * The vectors were produced independently (a Keccak-256 and JCS written in
 * another language) and the contracts repository checks the same file against
 * the escrow itself, so every one must come out byte for byte here too.
 */
@suite()
export class InvoiceCommitmentTest {
  private readonly service = new InvoiceCommitment()

  private fixturePath(name: string): string {
    return path.join(__dirname, '../fixture', name)
  }

  private fixture(): Fixture {
    return JSON.parse(
      fs.readFileSync(this.fixturePath('invoice-commitment.v1.json'), 'utf8'),
    )
  }

  private binding(vector: Vector): IInvoiceCommitmentBinding {
    return {
      chainId: vector.chainId,
      escrow: vector.escrow,
      allocationId: vector.allocationId,
    }
  }

  private commit(vector: Vector): string {
    return this.service.commit(vector.record, this.binding(vector), vector.salt)
  }

  /** An Invoice entity whose snapshot is `record`, as a read loads it. */
  private invoiceOf(record: IInvoiceRecord): Invoice {
    const invoice = new Invoice()
    const project = new Project()
    const issuer = new User()

    project.id = record.projectId
    issuer.id = record.issuerId

    invoice.id = record.invoiceId
    invoice.project = project
    invoice.user = issuer
    invoice.snapshotVersion = EInvoiceSnapshotVersion.V1
    invoice.issuerAddress = record.issuerAddress
    invoice.ownerAddress = record.ownerAddress
    invoice.currency = record.currency as EInvoiceCurrency
    invoice.rateHourCents = record.rateHourCents
    invoice.minutesActive = record.minutesActive
    invoice.amountCents = record.amountCents
    invoice.fromAt = new Date(record.periodStart)
    invoice.toAt = new Date(record.periodEnd)
    invoice.lines = record.lines.map((line) => ({ ...line }))
    invoice.state = EInvoiceState.REQUESTED

    return invoice
  }

  @test()
  fixture_isTheCopySharedWithTheContracts() {
    const digest = crypto
      .createHash('sha256')
      .update(fs.readFileSync(this.fixturePath('invoice-commitment.v1.json')))
      .digest('hex')

    expect(
      digest,
      'invoice-commitment.v1.json changed: change the contracts copy identically, and pin the new digest on both sides',
    ).to.equal(FIXTURE_SHA256)
  }

  @test()
  domain_isTheKeccakOfItsTag() {
    const fixture = this.fixture()

    expect(InvoiceCommitment.DOMAIN_TAG).to.equal(fixture.domainTag)
    expect(InvoiceCommitment.DOMAIN).to.equal(fixture.domain)
  }

  @test()
  commit_matchesEveryVectorByteForByte() {
    const { vectors } = this.fixture()

    expect(vectors).to.have.length.greaterThan(0)

    for (const vector of vectors) {
      expect(
        this.service.document(vector.record, this.binding(vector)),
        vector.name,
      ).to.equal(vector.document)
      expect(this.commit(vector), vector.name).to.equal(vector.commitment)
    }
  }

  /**
   * Every vector's record is an InvoiceRecord v1 the app itself produces from
   * a snapshot, so the vectors cover what is really submitted.
   */
  @test()
  vectors_holdRecordsTheAppProduces() {
    const record = new InvoiceRecord()

    for (const vector of this.fixture().vectors) {
      expect(
        record.serialise(this.invoiceOf(vector.record)),
        vector.name,
      ).to.equal(CanonicalJson.stringify(vector.record))
    }
  }

  /**
   * From issued invoice to commitment: the InvoiceRecord v1 vector for the
   * 90-minute, $20/h invoice, committed for the first vector's allocation,
   * is that vector's commitment - and the record's own bytes sit inside the
   * hashed document unchanged.
   */
  @test()
  commit_ofAnIssuedInvoiceEmbedsItsRecordVerbatim() {
    const [vector] = this.fixture().vectors
    const [recordVector] = JSON.parse(
      fs.readFileSync(this.fixturePath('invoice-record.v1.json'), 'utf8'),
    ).vectors
    const record = new InvoiceRecord()
    const invoice = this.invoiceOf(JSON.parse(recordVector.record))

    expect(
      this.service.commit(
        record.document(invoice),
        this.binding(vector),
        vector.salt,
      ),
    ).to.equal(vector.commitment)
    expect(vector.document.endsWith(`"record":${recordVector.record}}`)).to.eq(
      true,
    )
  }

  /**
   * Any change to what was billed, to where it was submitted, or to the salt
   * is a different commitment.
   */
  @test()
  commit_changesWithEveryRecordFieldTheBindingAndTheSalt() {
    const [vector] = this.fixture().vectors
    const clone = (): Vector => structuredClone(vector)
    const changed = (value: unknown): unknown =>
      typeof value === 'number' ? value + 1 : `${String(value)}0`
    const mutations: [string, (copy: Vector) => void][] = []

    for (const key of Object.keys(vector.record) as (keyof IInvoiceRecord)[]) {
      if (key === 'lines' || key === 'version') {
        continue
      }

      mutations.push([
        `record.${key}`,
        (copy) =>
          ((copy.record as unknown as Record<string, unknown>)[key] = changed(
            copy.record[key],
          )),
      ])
    }

    for (const key of Object.keys(vector.record.lines[0])) {
      mutations.push([
        `record.lines[0].${key}`,
        (copy) => {
          const line = copy.record.lines[0] as unknown as Record<
            string,
            unknown
          >

          line[key] = changed(line[key])
        },
      ])
    }

    mutations.push(
      ['record.lines dropped', (copy) => copy.record.lines.pop()],
      ['record.lines swapped', (copy) => copy.record.lines.reverse()],
      ['chainId', (copy) => (copy.chainId = 1)],
      ['escrow', (copy) => (copy.escrow = `0x${'1'.repeat(40)}`)],
      ['allocationId', (copy) => (copy.allocationId = `0x${'1'.repeat(64)}`)],
      [
        'salt, one bit',
        (copy) =>
          (copy.salt = `${copy.salt.slice(0, -1)}${(
            parseInt(copy.salt.slice(-1), 16) ^ 1
          ).toString(16)}`),
      ],
    )

    // Every record field is covered, so a field added to the record without
    // being committed shows up here.
    expect(
      mutations.filter(([name]) => /^record\.\w+$/.test(name)),
    ).to.have.length(Object.keys(vector.record).length - 2)

    for (const [name, mutate] of mutations) {
      const copy = clone()

      mutate(copy)

      expect(this.commit(copy), name).not.to.equal(vector.commitment)
    }
  }

  /** The binding is canonical: checksummed or upper-case hex commits alike. */
  @test()
  commit_readsTheBindingCaseInsensitively() {
    const [vector] = this.fixture().vectors

    expect(
      this.service.commit(
        vector.record,
        {
          chainId: vector.chainId,
          escrow: web3.utils.toChecksumAddress(vector.escrow),
          allocationId: `0x${vector.allocationId.slice(2).toUpperCase()}`,
        },
        vector.salt.toUpperCase().replace('0X', '0x'),
      ),
    ).to.equal(vector.commitment)
  }

  /**
   * The formula the escrow panel used - keccak256 of
   * `work-address:invoice:<contractId>:<allocationId>:<amount>` - hashed only
   * public ids, so anyone could recompute it and it said nothing about the
   * invoice. It matches no v1 commitment.
   */
  @test()
  commit_isNotTheRetiredStringFormula() {
    const { vectors, retired } = this.fixture()

    for (const vector of vectors) {
      const retiredCommitment = web3.utils.keccak256(
        Buffer.from(
          `work-address:invoice:${retired.contractId}:${vector.allocationId}:${vector.amount}`,
          'utf8',
        ),
      )

      expect(this.commit(vector), vector.name).not.to.equal(retiredCommitment)
    }
  }

  @test()
  commit_refusesASaltThatIsNotThirtyTwoRandomBytes() {
    const [vector] = this.fixture().vectors
    const binding = this.binding(vector)

    for (const salt of [
      `0x${'0'.repeat(64)}`,
      vector.salt.slice(0, -2),
      `${vector.salt}00`,
      vector.salt.slice(2),
      `0x${'g'.repeat(64)}`,
    ]) {
      expect(
        () => this.service.commit(vector.record, binding, salt),
        salt,
      ).to.throw(TypeError)
    }
  }

  @test()
  commit_refusesABindingThatIsNotAnEscrowAllocation() {
    const [vector] = this.fixture().vectors
    const bindings: IInvoiceCommitmentBinding[] = [
      { ...this.binding(vector), chainId: 0 },
      { ...this.binding(vector), chainId: -1 },
      { ...this.binding(vector), chainId: 1.5 },
      { ...this.binding(vector), escrow: vector.record.issuerAddress + '00' },
      {
        ...this.binding(vector),
        escrow: `0:${'4a'.repeat(32)}`,
      },
      {
        ...this.binding(vector),
        allocationId: vector.allocationId.slice(0, -2),
      },
    ]

    for (const binding of bindings) {
      expect(
        () => this.service.commit(vector.record, binding, vector.salt),
        JSON.stringify(binding),
      ).to.throw(TypeError)
    }
  }

  @test()
  commit_refusesARecordOfAnotherVersion() {
    const [vector] = this.fixture().vectors

    expect(() =>
      this.service.commit(
        { ...vector.record, version: 2 },
        this.binding(vector),
        vector.salt,
      ),
    ).to.throw(TypeError, /InvoiceRecord v1/)
  }
}

import { inject, injectable } from 'inversify'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'

import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { UserRepository } from '@/repository/user-repository'
import { Invoice } from '@/entity/invoice'
import {
  EInvoiceCurrency,
  EInvoiceSnapshotVersion,
  EInvoiceState,
  IInvoiceRecord,
} from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { EUserRole } from '@/model/user'
import { InvoiceRecord } from '@/service/invoice-record'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'

@injectable()
export class InvoiceFixture {
  /**
   * The marketplace contract the commitment vectors' project was hired
   * under: the contract id `invoice-commitment.v1.json` names. The vectors'
   * allocation ids are not derived from it - they predate the derivation -
   * so a test submitting a vector pins the derivation for that call.
   */
  public static readonly VECTOR_CONTRACT_ID =
    '6b0f5c52-3f0e-4d4e-9a53-2f7f1f0a9c11'

  @inject('InvoiceRepository')
  protected invoiceRepository: InvoiceRepository
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('UserRepository')
  protected userRepository: UserRepository

  /** `amountCents` - whole cents, matching the entity. */
  public create(
    project: Project,
    amountCents: number,
    state: EInvoiceState,
  ): Promise<Invoice> {
    const invoice = new Invoice()

    invoice.project = project
    invoice.amountCents = amountCents
    invoice.state = state
    invoice.fromAt = new Date(Date.now() - 86400000)
    invoice.toAt = new Date()

    return runPromise(this.invoiceRepository.saveSingle(invoice))
  }

  /**
   * An unpaid invoice `issuer` raised on `project` for `amountCents`, with
   * the v1 snapshot issuance writes: one hour-long line of 60 active minutes
   * at `amountCents` an hour, so the snapshot explains its own amount. It
   * links no time rows - the record reads the snapshot, not the entries.
   */
  public createIssued(
    project: Project,
    issuer: User,
    amountCents: number,
  ): Promise<Invoice> {
    // One instant; both ends derive from it.
    const end = new Date(Math.floor(Date.now() / 60000) * 60000)
    const start = new Date(end.getTime() - 3600000)

    return this.createFromRecord(
      {
        version: InvoiceRecord.VERSION,
        invoiceId: '',
        projectId: project.id,
        issuerId: issuer.id,
        issuerAddress: WalletAddress.toCanonical(issuer.address),
        ownerAddress: WalletAddress.toCanonical(project.user.address),
        currency: EInvoiceCurrency.USD,
        rateHourCents: amountCents,
        minutesActive: 60,
        amountCents,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        lines: [
          {
            timeId: '00000000-0000-4000-8000-000000000000',
            fromAt: start.toISOString(),
            toAt: end.toISOString(),
            minutesActive: 60,
          },
        ],
      },
      project,
      issuer,
    )
  }

  /**
   * The invoice whose InvoiceRecord v1 is `record`: its snapshot columns,
   * and its own id when the record names one, so a test can reproduce a
   * published vector byte for byte.
   */
  public createFromRecord(
    record: IInvoiceRecord,
    project: Project,
    issuer: User,
  ): Promise<Invoice> {
    const invoice = new Invoice()

    if (record.invoiceId) {
      invoice.id = record.invoiceId
    }

    invoice.project = project
    invoice.user = issuer
    invoice.fromAt = new Date(record.periodStart)
    invoice.toAt = new Date(record.periodEnd)
    invoice.snapshotVersion = EInvoiceSnapshotVersion.V1
    invoice.issuerAddress = record.issuerAddress
    invoice.ownerAddress = record.ownerAddress
    invoice.currency = record.currency as EInvoiceCurrency
    invoice.rateHourCents = record.rateHourCents
    invoice.minutesActive = record.minutesActive
    invoice.amountCents = record.amountCents
    invoice.lines = record.lines.map((line) => ({ ...line }))
    invoice.state = EInvoiceState.REQUESTED
    invoice.paidAt = null

    return runPromise(this.invoiceRepository.saveSingle(invoice))
  }

  /**
   * The invoice whose record is `record` - a published vector's - with the
   * issuer, owner and project its ids and addresses name, all created on
   * first use and reused after: the ids are fixed, and the test database
   * lives for the whole run, so every suite asking for one vector shares it.
   * The project is a marketplace hire under VECTOR_CONTRACT_ID, the issuer
   * its worker and the freelancer it hired, as escrow submission requires.
   */
  public async ensureForRecord(record: IInvoiceRecord): Promise<Invoice> {
    const existing = await runPromise(
      this.invoiceRepository.findOneBy({
        where: { id: record.invoiceId },
        relations: { project: true, user: true },
      }),
    )

    if (existing) {
      return existing
    }

    const issuer =
      (await runPromise(
        this.userRepository.findOneBy({ where: { id: record.issuerId } }),
      )) ?? (await this.userAt(record.issuerAddress, record.issuerId))
    const project =
      (await runPromise(
        this.projectRepository.findOneBy({ where: { id: record.projectId } }),
      )) ?? (await this.projectFor(record, issuer))

    return this.createFromRecord(record, project, issuer)
  }

  private userAt(address: string, id?: string): Promise<User> {
    const user = new User()

    if (id) {
      user.id = id
    }

    user.address = address
    user.tz = 'UTC'
    user.roles = [EUserRole.ROLE_USER]

    return runPromise(this.userRepository.saveSingle(user))
  }

  private async projectFor(
    record: IInvoiceRecord,
    issuer: User,
  ): Promise<Project> {
    const project = new Project()

    project.id = record.projectId
    project.title = 'Invoice commitment vector'
    project.text = 'Invoice commitment vector'
    project.user = await this.userAt(record.ownerAddress)
    project.rateHour = record.rateHourCents / 100
    project.state = EProjectState.ACTIVE
    project.workerAddresses = [issuer.address]
    project.viewerAddresses = []
    project.trackScreenshots = false
    project.trackProcesses = false
    project.marketplaceContractId = InvoiceFixture.VECTOR_CONTRACT_ID
    project.marketplaceFreelancerAddress = WalletAddress.toCanonical(
      issuer.address,
    )

    return runPromise(this.projectRepository.saveSingle(project))
  }
}

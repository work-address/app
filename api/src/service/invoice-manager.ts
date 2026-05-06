import { inject, injectable } from 'inversify'

import { Invoice } from '@/entity/invoice'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { User } from '@/entity/user'
import { InvoiceCreateDto } from '@/model/dto/invoice'
import moment from 'moment'
import { ProjectRepository } from '@/repository/project-repository'
import { Project } from '@/entity/project'
import RejectedExecutionException from '@/exception/rejected-execution-exception'
import { TimeRepository } from '@/repository/time-repository'

@injectable()
export class InvoiceManager {
  @inject('InvoiceRepository')
  protected invoiceRepository: InvoiceRepository
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('TimeRepository')
  protected timeRepository: TimeRepository

  public async create(
    data: InvoiceCreateDto,
    project: Project,
    owner: User,
  ): Promise<Invoice> {
    const invoice = new Invoice()

    const projectExisting = await this.projectRepository.findProjectOwnedBy(
      project,
      owner,
    )

    if (!projectExisting) {
      throw new RejectedExecutionException(
        `Wrong user: the given project belongs to someone else`,
      )
    }

    const times = await this.timeRepository.findTimeBetweenForProject(
      data.fromUnix,
      data.toUnix,
      project,
      owner,
    )

    const rate = Number(project.rateHour) || 0
    const hours =
      times.reduce((sum, t) => sum + (t.minutesActive || 0) / 60, 0) || 0

    invoice.fromAt = moment.utc(data.fromUnix).toDate()
    invoice.toAt = moment.utc(data.toUnix).toDate()
    invoice.project = project
    invoice.amount = rate * hours

    return this.invoiceRepository.validateAndSave(invoice)
  }
}

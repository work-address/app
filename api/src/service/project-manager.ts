import { inject, injectable } from 'inversify'

import { Project } from '@/entity/project'
import { ProjectRepository } from '@/repository/project-repository'
import { UserRepository } from '@/repository/user-repository'
import { EProjectState } from '@/model/project'
import { User } from '@/entity/user'
import moment from 'moment'
import { Time } from '@/entity/time'
import { TimeRepository } from '@/repository/time-repository'
import RejectedExecutionException from '@/exception/rejected-execution-exception'
import { ProjectAccessAddresses } from '@/model/dto/project'

@injectable()
export class ProjectManager {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('TimeRepository')
  protected timeRepository: TimeRepository
  @inject('UserRepository')
  protected userRepository: UserRepository

  public async findProjectCheckAccess(
    project: Project,
    user: User,
  ): Promise<Project | undefined> {
    return this.projectRepository.findProjectWithAccess(project, user)
  }

  public async close(project: Project): Promise<void> {
    project.state = EProjectState.INACTIVE

    await this.save(project)
  }

  public async createAndSave(data: Project): Promise<Project> {
    if (
      data.workerAddresses !== undefined ||
      data.viewerAddresses !== undefined
    ) {
      await this.setAccessAddresses(data, {
        workerAddresses: data.workerAddresses ?? [],
        viewerAddresses: data.viewerAddresses ?? [],
      })
    }

    return this.save(data)
  }

  public async editAndSave(project: Project, data: Project): Promise<void> {
    if (
      data.workerAddresses !== undefined ||
      data.viewerAddresses !== undefined
    ) {
      await this.setAccessAddresses(project, {
        workerAddresses: data.workerAddresses ?? project.workerAddresses ?? [],
        viewerAddresses: data.viewerAddresses ?? project.viewerAddresses ?? [],
      })
    }

    const editable: Partial<Project> = { ...data }
    delete editable.workerAddresses
    delete editable.viewerAddresses
    delete editable.workers
    delete editable.viewers
    delete editable.user
    delete editable.invoices
    delete editable.time
    delete editable.statistics
    delete editable.id
    delete editable.createdAt
    delete editable.updatedAt

    Object.assign(project, editable)

    await this.save(project)
  }

  private async setAccessAddresses(
    project: Project,
    data: ProjectAccessAddresses,
  ): Promise<void> {
    const ownerAddress = project.user.address
    const workerAddresses = [...new Set(data.workerAddresses)].filter(
      (address) => address !== ownerAddress,
    )
    const viewerAddresses = [...new Set(data.viewerAddresses)].filter(
      (address) => address !== ownerAddress,
    )
    const addresses = [...new Set([...workerAddresses, ...viewerAddresses])]

    if (addresses.length) {
      const existingUsers =
        await this.userRepository.countByAddresses(addresses)

      if (existingUsers !== addresses.length) {
        throw new RejectedExecutionException(
          'One or more users in workerAddresses or viewerAddresses do not exist',
        )
      }
    }

    project.workerAddresses = workerAddresses
    project.viewerAddresses = viewerAddresses
  }

  public save(project: Project) {
    return this.projectRepository.saveSingle(project)
  }

  // @deprecated remove demo data
  public async createDemoData(user: User): Promise<void> {
    const project = new Project()
    project.title = 'Your first project'
    project.text = 'Demo'
    project.rateHour = 0
    project.user = user
    project.state = EProjectState.ACTIVE

    await this.save(project)

    const times = []
    const fromAt = moment().startOf('day')
    const toAt = moment().startOf('day').add(10, 'minutes')

    for (let i = 1; i < 6; i++) {
      const time = new Time()
      time.project = project
      time.user = user
      time.note = `Timesheet demo ${i}`
      time.mouseKeys = 0
      time.mouseDistance = 0
      time.keyboardKeys = 0
      time.minutesActive = i
      time.fromAt = fromAt.toDate()
      time.toAt = toAt.toDate()

      times.push(time)

      fromAt.add(1 * 10, 'minutes')
      toAt.add(1 * 10, 'minutes')
    }

    await this.timeRepository.saveMany(times)
  }
}

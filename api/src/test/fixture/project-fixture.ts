import { faker } from '@faker-js/faker'
import { inject, injectable } from 'inversify'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'

import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'

@injectable()
export class ProjectFixture {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository

  public create(user: User, state: EProjectState): Promise<Project> {
    const project = new Project()

    project.title = faker.string.uuid()
    project.text = faker.string.uuid()
    project.user = user
    project.state = state
    project.trackScreenshots = false
    project.trackProcesses = false

    return this.projectRepository.saveSingle(project)
  }

  public createPersonal(
    user: User,
    rateHour: number = 0,
    trackScreenshots?: boolean,
    trackProcesses?: boolean,
  ): Promise<Project> {
    const project = new Project()

    project.title = faker.string.uuid()
    project.text = faker.string.uuid()
    project.user = user
    project.rateHour = rateHour
    project.state = EProjectState.ACTIVE
    project.trackScreenshots = trackScreenshots
    project.trackProcesses = trackProcesses

    return this.projectRepository.saveSingle(project)
  }
}

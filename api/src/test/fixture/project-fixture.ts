import { randomUUID } from 'crypto'
import { faker } from '@faker-js/faker'
import { inject, injectable } from 'inversify'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'

import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'

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

    return runPromise(this.projectRepository.saveSingle(project))
  }

  /**
   * A project as a marketplace hire makes it: owned by the client, `worker`
   * its one worker, and created for a fresh marketplace contract id.
   */
  public createHired(
    client: User,
    worker: User,
    rateHour: number = 0,
  ): Promise<Project> {
    const project = new Project()

    project.title = faker.string.uuid()
    project.text = faker.string.uuid()
    project.user = client
    project.rateHour = rateHour
    project.state = EProjectState.ACTIVE
    project.workerAddresses = [WalletAddress.toCanonical(worker.address)]
    project.viewerAddresses = []
    project.trackScreenshots = false
    project.trackProcesses = false
    project.marketplaceContractId = randomUUID()
    // As the signed hire records it.
    project.marketplaceFreelancerAddress = WalletAddress.toCanonical(
      worker.address,
    )

    return runPromise(this.projectRepository.saveSingle(project))
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

    return runPromise(this.projectRepository.saveSingle(project))
  }
}

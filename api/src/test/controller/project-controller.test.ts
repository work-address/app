import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { BaseControllerTest } from './base-controller.test'
import { ProjectManager } from '../../service/project-manager'
import { ProjectRepository } from '../../repository/project-repository'
import { EProjectState } from '../../interface/project'

@suite
export class ProjectControllerTest extends BaseControllerTest {
  protected projectManager: ProjectManager
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
    this.projectManager = this.container.get('ProjectManager')
  }

  @test
  async close() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const res = await this.http.request({
      url: `${this.url}/api/project/${project.id}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
    })

    const updated = await this.projectRepository.findOneByIdOrFail(project.id)

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.deep.equal({})
    expect(updated.state).to.be.eq(EProjectState.INACTIVE)
  }

  @test()
  async searchUserPersonalSorted() {
    const user = await this.userFixture.createUser()
    const projectA = await this.projectFixture.createPersonal(user)
    const projectB = await this.projectFixture.createPersonal(user)
    const projectC = await this.projectFixture.createPersonal(user)

    projectA.title = 'AAA'
    projectB.title = 'BBB'
    projectC.title = 'CCC'

    await this.projectRepository.saveMany([projectA, projectB, projectC])

    const config = {
      url: `${this.url}/api/project/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {},
        sort: { title: 'ASC' },
        page: 0,
      },
    }

    const res = await this.http.request(config)

    expect(res.data[0].length).to.be.eq(3)
    expect(res.data[0][0].title).to.be.eq(projectA.title)
    expect(res.data[0][1].title).to.be.eq(projectB.title)
    expect(res.data[0][2].title).to.be.eq(projectC.title)
    expect(res.data[0][0].state).to.be.eq(EProjectState.ACTIVE)
  }

  @test()
  async searchOwnerDraft() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      user,
      EProjectState.INACTIVE,
    )

    const config = {
      url: `${this.url}/api/project/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {
          userId: user.id,
          state: EProjectState.INACTIVE,
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
    }

    const res = await this.http.request(config)

    expect(res.data[0].length).to.be.eq(1)
    expect(res.data[0][0].id).to.be.eq(project.id)
    expect(res.data[0][0].state).to.be.eq(EProjectState.INACTIVE)
  }

  @test()
  async searchOwnerArchived() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      user,
      EProjectState.INACTIVE,
    )

    const config = {
      url: `${this.url}/api/project/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {
          userId: user.id,
          state: EProjectState.INACTIVE,
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
    }

    const res = await this.http.request(config)

    expect(res.data[0].length).to.be.eq(1)
    expect(res.data[0][0].id).to.be.eq(project.id)
    expect(res.data[0][0].state).to.be.eq(EProjectState.INACTIVE)
  }
}

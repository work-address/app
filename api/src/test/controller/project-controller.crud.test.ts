import faker from 'faker'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/interface/project'

@suite
export class ProjectControllerCrudTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
  }

  @test
  async create() {
    const owner = await this.userFixture.createUser()
    const data = {
      trackScreenshots: false,
      trackProcesses: true,
      title: faker.datatype.uuid(),
      text: faker.datatype.uuid(),
      state: EProjectState.INACTIVE,
    }

    const res = await this.http.request({
      url: `${this.url}/api/project`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      data,
    })

    const id = res.headers.location.split('/')[3]
    const project = await this.projectRepository.findOneByIdOrFail(id)

    expect(res.status).to.be.equal(201)

    expect(project.title).to.be.eq(data.title)
    expect(project.text).to.be.eq(data.text)
    expect(project.trackScreenshots).to.be.eq(data.trackScreenshots)
    expect(project.trackProcesses).to.be.eq(data.trackProcesses)
  }

  @test
  async readAsNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let res = null

    try {
      await this.http.request({
        url: `${this.url}/api/project/${project.id}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
      })
    } catch (error: any) {
      res = error.response
    }

    expect(res.status).to.be.equal(404)
  }

  @test
  async readAsOwner() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.projectRepository.saveSingle(project)

    const res = await this.http.request({
      url: `${this.url}/api/project/${project.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.id).to.be.equal(project.id)
    expect(res.data.state).to.be.equal(EProjectState.ACTIVE)
  }

  @test
  async edit() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.INACTIVE,
    )

    const data = {
      title: faker.datatype.uuid(),
      text: faker.datatype.uuid(),
      state: EProjectState.ACTIVE,
      trackScreenshots: true,
      trackProcesses: true,
    }

    const res = await this.http.request({
      url: `${this.url}/api/project/${project.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      data,
    })

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.deep.equal({})

    expect(projectUpdated.title).to.be.eq(data.title)
    expect(projectUpdated.state).to.be.eq(data.state)
    expect(projectUpdated.text).to.be.eq(data.text)
    expect(projectUpdated.trackScreenshots).to.be.eq(data.trackScreenshots)
    expect(projectUpdated.trackProcesses).to.be.eq(data.trackProcesses)
  }

  @test
  async delete() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const res = await this.http.request({
      url: `${this.url}/api/project/${project.id}`,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
    })

    const updated = await this.projectRepository.findOneBy({
      where: {
        id: project.id,
      },
    })

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.deep.equal({})
    expect(updated).to.be.undefined
  }
}

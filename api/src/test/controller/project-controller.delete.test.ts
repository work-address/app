import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { projectControllerDelete } from '@app/api-client'
import axios from 'axios'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'

@suite
export class ProjectControllerDeleteTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
  }

  @test
  async delete() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const client = this.apiClient()
    const res = await projectControllerDelete({
      client,
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    const updated = await this.projectRepository.findOneBy({
      where: {
        id: project.id,
      },
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updated).to.be.undefined
  }

  @test()
  async delete_deniedForNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerDelete({
        client: this.apiClient(),
        path: { id: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)

    const stillThere = await this.projectRepository.findOneBy({
      where: { id: project.id },
    })
    expect(stillThere).to.not.eq(undefined)
    expect(stillThere!.id).to.be.eq(project.id)
  }

  @test()
  async delete_requiresAuthorization() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerDelete({
        client: this.apiClient(),
        path: { id: project.id as never },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
  }
}

import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import { projectControllerClose } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectManager } from '@/service/project-manager'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { runPromise } from '@/service/effect-bridge'

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

    const client = this.apiClient()
    const res = await projectControllerClose({
      client,
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    const updated = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updated.state).to.be.eq(EProjectState.INACTIVE)
  }

  @test()
  async close_deniedForNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerClose({
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
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(403)

    const unchanged = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )
    expect(unchanged.state).to.be.eq(EProjectState.ACTIVE)
  }
}

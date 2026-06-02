import { expect } from 'chai'
import axios from 'axios'
import faker from 'faker'
import { suite, test } from '@testdeck/mocha'

import { userControllerSearch } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'

@suite()
export class UserControllerSearchTest extends BaseControllerTest {
  private authHeaders(user: User) {
    return {
      Authorization: this.authenticator.getTokens(user).accessToken,
    }
  }

  @test()
  async search_requiresAuthorization() {
    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
        body: {
          filter: { role: EUserRole.ROLE_USER },
          sort: { createdAt: 'DESC' },
          page: 0,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
  }

  @test()
  async search_filtersByUserId() {
    const user = await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(user),
      body: {
        filter: { id: user.id },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{ id: string; address: string }>
    expect(res.status).to.be.equal(200)
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(user.id)
    expect(rows[0].address).to.be.eq(user.address)
  }

  @test()
  async search_filtersByRole() {
    const user = await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(user),
      body: {
        filter: { role: EUserRole.ROLE_USER },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{ roles: EUserRole[] }>
    expect(res.status).to.be.equal(200)
    expect(rows.length).to.be.greaterThan(0)
    expect(rows.every((row) => row.roles.includes(EUserRole.ROLE_USER))).to.be
      .true
  }

  @test()
  async search_returnsEmptyWhenNoRowsMatch() {
    const user = await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(user),
      body: {
        filter: { id: faker.datatype.uuid() },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.be.deep.eq([])
    expect(res.data[1]).to.be.equal(0)
  }

  @test()
  async search_rejectsInvalidFilterFieldType() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(user),
        body: {
          filter: { id: 123 as never },
          sort: { createdAt: 'DESC' },
          page: 0,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_idFilter_secondPage_returnsEmptySlice() {
    const user = await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(user),
      body: {
        filter: { id: user.id },
        sort: { createdAt: 'ASC' },
        page: 1,
        limit: 1,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.be.deep.eq([])
    expect(res.data[1]).to.be.eq(1)
  }

  @test()
  async search_roleFilter_respectsLimit() {
    const user = await this.userFixture.createUser()
    await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(user),
      body: {
        filter: { role: EUserRole.ROLE_USER },
        sort: { createdAt: 'ASC' },
        page: 0,
        limit: 2,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as unknown[]
    expect(rows.length).to.be.at.most(2)
    expect(res.data[1]).to.be.a('number')
    expect(res.data[1] as number).to.be.greaterThan(0)
  }

  @test()
  async search_sortCreatedAt_desc_isNonIncreasing() {
    const user = await this.userFixture.createUser()
    await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(user),
      body: {
        filter: { role: EUserRole.ROLE_USER },
        sort: { createdAt: 'DESC' },
        page: 0,
        limit: 50,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ createdAt: string }>
    expect(rows.length).to.be.greaterThan(1)
    for (let i = 0; i < rows.length - 1; i++) {
      const a = new Date(rows[i].createdAt).getTime()
      const b = new Date(rows[i + 1].createdAt).getTime()
      expect(a).to.be.at.least(b)
    }
  }

  @test()
  async search_combinedIdAndRole_matchesSameUser() {
    const user = await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(user),
      body: {
        filter: { id: user.id, role: EUserRole.ROLE_USER },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(user.id)
  }

  @test()
  async search_rejectsInvalidLimitType() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(user),
        body: {
          filter: { role: EUserRole.ROLE_USER },
          sort: { createdAt: 'DESC' },
          page: 0,
          limit: '1' as never,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_sortCreatedAt_asc_isNonDecreasing() {
    const user = await this.userFixture.createUser()
    await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(user),
      body: {
        filter: { role: EUserRole.ROLE_USER },
        sort: { createdAt: 'ASC' },
        page: 0,
        limit: 80,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ createdAt: string }>
    expect(rows.length).to.be.greaterThan(1)
    for (let i = 0; i < rows.length - 1; i++) {
      const a = new Date(rows[i].createdAt).getTime()
      const b = new Date(rows[i + 1].createdAt).getTime()
      expect(b).to.be.at.least(a)
    }
  }

  @test()
  async search_rejectsInvalidIdUuid() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(user),
        body: {
          filter: { id: 'not-uuid' },
          sort: { createdAt: 'ASC' },
          page: 0,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_rejectsInvalidRoleEnum() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(user),
        body: {
          filter: { role: 'ROLE_GHOST' as never },
          sort: { createdAt: 'ASC' },
          page: 0,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_rejectsMissingPageField() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(user),
        body: {
          filter: { role: EUserRole.ROLE_USER },
          sort: { createdAt: 'ASC' },
        } as never,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }
}

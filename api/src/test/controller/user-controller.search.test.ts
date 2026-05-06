import { expect } from 'chai'
import axios from 'axios'
import faker from 'faker'
import { suite, test } from '@testdeck/mocha'

import { userControllerSearch } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EUserRole } from '@/model/user'

@suite()
export class UserControllerSearchTest extends BaseControllerTest {
  @test()
  async search_filtersByUserId() {
    const user = await this.userFixture.createUser()
    const client = this.apiClient()

    const res = await userControllerSearch({
      client,
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
    await this.userFixture.createUser()
    const client = this.apiClient()

    const res = await userControllerSearch({
      client,
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
    expect(
      rows.every((row) => row.roles.includes(EUserRole.ROLE_USER)),
    ).to.be.true
  }

  @test()
  async search_returnsEmptyWhenNoRowsMatch() {
    const client = this.apiClient()

    const res = await userControllerSearch({
      client,
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
    const client = this.apiClient()

    let error: unknown

    try {
      await userControllerSearch({
        client,
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
    await this.userFixture.createUser()
    await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
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
    await this.userFixture.createUser()
    await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
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
    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
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
    await this.userFixture.createUser()
    await this.userFixture.createUser()

    const res = await userControllerSearch({
      client: this.apiClient(),
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
    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
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
    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
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
    let error: unknown

    try {
      await userControllerSearch({
        client: this.apiClient(),
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

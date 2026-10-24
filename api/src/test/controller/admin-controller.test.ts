import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import {
  adminControllerSearch,
  adminControllerStats,
  authControllerStatus,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'

type Row = { id: string; email?: string; lastSeenAt?: string }

@suite()
export class AdminControllerTest extends BaseControllerTest {
  private get users(): UserRepository {
    return this.container.get('UserRepository')
  }

  private authHeaders(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  private async createAdmin(): Promise<User> {
    const user = await this.userFixture.createUser()
    user.roles = [EUserRole.ROLE_USER, EUserRole.ROLE_ADMIN]

    return runPromise(this.users.saveSingle(user))
  }

  private async statusOf(promise: Promise<unknown>): Promise<number> {
    try {
      await promise
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) throw error

      return error.response?.status ?? 0
    }

    return 200
  }

  @test()
  async search_requiresAuthorization() {
    const status = await this.statusOf(
      adminControllerSearch({
        client: this.apiClient(),
        body: { page: 0 },
        throwOnError: true,
      }),
    )

    expect(status).to.equal(401)
  }

  @test()
  async search_refusesARegularUser() {
    const user = await this.userFixture.createUser()

    const searchStatus = await this.statusOf(
      adminControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(user),
        body: { page: 0 },
        throwOnError: true,
      }),
    )
    const statsStatus = await this.statusOf(
      adminControllerStats({
        client: this.apiClient(),
        headers: this.authHeaders(user),
        throwOnError: true,
      }),
    )

    expect(searchStatus).to.equal(403)
    expect(statsStatus).to.equal(403)
  }

  @test()
  async search_listsNewestFirstWithContactDetails() {
    const admin = await this.createAdmin()
    const older = await this.userFixture.createUser()
    const newer = await this.userFixture.createUser()

    const res = await adminControllerSearch({
      client: this.apiClient(),
      headers: this.authHeaders(admin),
      body: { page: 0, filter: { ids: [older.id, newer.id] } },
      throwOnError: true,
    })

    const [rows, total] = res.data as [Row[], number]
    expect(total).to.equal(2)
    expect(rows.map((r) => r.id)).to.deep.equal([newer.id, older.id])
    expect(rows[0].email).to.equal(newer.email)
  }

  @test()
  async search_paginates() {
    const admin = await this.createAdmin()
    const created = [
      await this.userFixture.createUser(),
      await this.userFixture.createUser(),
      await this.userFixture.createUser(),
    ]
    const ids = created.map((u) => u.id)

    const page = (n: number) =>
      adminControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(admin),
        body: { page: n, limit: 2, filter: { ids } },
        throwOnError: true,
      }).then((res) => res.data as [Row[], number])

    const [first, total] = await page(0)
    const [second] = await page(1)

    expect(total).to.equal(3)
    expect(first.map((r) => r.id)).to.deep.equal([ids[2], ids[1]])
    expect(second.map((r) => r.id)).to.deep.equal([ids[0]])
  }

  @test()
  async search_matchesQueryAndPremium() {
    const admin = await this.createAdmin()
    const plain = await this.userFixture.createUser()
    const premium = await this.userFixture.createUser()
    premium.premium = true
    await runPromise(this.users.saveSingle(premium))

    const search = (filter: Record<string, unknown>) =>
      adminControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(admin),
        body: { page: 0, filter: { ids: [plain.id, premium.id], ...filter } },
        throwOnError: true,
      }).then((res) => (res.data as [Row[], number])[0].map((r) => r.id))

    expect(await search({ query: plain.email!.toUpperCase() })).to.deep.equal([
      plain.id,
    ])
    expect(await search({ query: premium.address.slice(2, 12) })).to.deep.equal(
      [premium.id],
    )
    expect(await search({ premium: true })).to.deep.equal([premium.id])
    expect(await search({ premium: false })).to.deep.equal([plain.id])
  }

  @test()
  async search_rejectsAnOversizedPage() {
    const admin = await this.createAdmin()

    const status = await this.statusOf(
      adminControllerSearch({
        client: this.apiClient(),
        headers: this.authHeaders(admin),
        body: { page: 0, limit: 500 },
        throwOnError: true,
      }),
    )

    expect(status).to.equal(400)
  }

  @test()
  async stats_zeroFillsTheWindowAndCountsToday() {
    const admin = await this.createAdmin()
    await this.userFixture.createUser()

    const res = await adminControllerStats({
      client: this.apiClient(),
      headers: this.authHeaders(admin),
      query: { days: 7 },
      throwOnError: true,
    })

    const today = new Date().toISOString().slice(0, 10)
    expect(res.data.signups).to.have.length(7)
    expect(res.data.signups[6].date).to.equal(today)
    expect(res.data.signups[6].count).to.be.greaterThan(0)
    expect(res.data.total).to.be.at.least(res.data.signupsInWindow)
  }

  @test()
  async status_marksTheAccountSeenAtMostHourly() {
    const user = await this.userFixture.createUser()
    const status = () =>
      authControllerStatus({
        client: this.apiClient(),
        headers: this.authHeaders(user),
        throwOnError: true,
      })
    const lastSeen = async () =>
      (await runPromise(this.users.findOneByIdOrFail(user.id))).lastSeenAt

    await status()
    const first = await lastSeen()
    await status()
    const second = await lastSeen()

    expect(first).to.be.instanceOf(Date)
    expect(second!.getTime()).to.equal(first!.getTime())
  }
}

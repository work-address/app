import { expect } from 'chai'
import axios from 'axios'
import faker from 'faker'
import { suite, test } from '@testdeck/mocha'

import { invoiceControllerSearch } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EProjectState } from '@/model/project'
import { EInvoiceState } from '@/model/invoice'
import { InvoiceRepository } from '@/repository/invoice-repository'

@suite()
export class InvoiceControllerSearchTest extends BaseControllerTest {
  protected invoiceRepository: InvoiceRepository

  constructor() {
    super()
    this.invoiceRepository = this.container.get('InvoiceRepository')
  }

  @test()
  async search_requiresAuthorization() {
    let error: unknown

    try {
      await invoiceControllerSearch({
        client: this.apiClient(),
        body: {
          filter: { projectId: faker.datatype.uuid() },
          sort: { fromAt: 'DESC' },
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
  async search_doesNotReturnInvoicesFromOtherOwners() {
    const ownerA = await this.userFixture.createUser()
    const ownerB = await this.userFixture.createUser()
    const projectA = await this.projectFixture.create(
      ownerA,
      EProjectState.ACTIVE,
    )
    const projectB = await this.projectFixture.create(
      ownerB,
      EProjectState.ACTIVE,
    )
    const visible = await this.invoiceFixture.create(
      projectA,
      33,
      EInvoiceState.PAID,
    )
    await this.invoiceFixture.create(projectB, 77, EInvoiceState.PAID)

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(ownerA).accessToken,
      },
      body: {
        filter: {},
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.map((row) => row.id)).to.deep.eq([visible.id])
    expect(rows.length).to.be.eq(1)
  }

  @test()
  async search_rejectsMissingPageField() {
    const owner = await this.userFixture.createUser()
    let error: unknown

    try {
      await invoiceControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          filter: {},
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

  @test()
  async search_filtersByAllAvailableFields() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const fromAt = new Date(Date.now() - 10 * 86400000)
    const toAt = new Date(Date.now() - 5 * 86400000)

    const match = await this.invoiceFixture.create(
      project,
      120,
      EInvoiceState.PAID,
    )
    const mismatch = await this.invoiceFixture.create(
      project,
      20,
      EInvoiceState.REQUESTED,
    )

    match.fromAt = fromAt
    match.toAt = toAt
    mismatch.fromAt = new Date(Date.now() - 20 * 86400000)
    mismatch.toAt = new Date(Date.now() - 18 * 86400000)

    await this.invoiceRepository.saveMany([match, mismatch])

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          fromAt: new Date(fromAt.getTime() - 60000).toISOString(),
          toAt: new Date(toAt.getTime() + 60000).toISOString(),
          amountFrom: 100,
          amountTo: 150,
          state: EInvoiceState.PAID,
        },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{ id: string }>
    expect(res.status).to.be.equal(200)
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(match.id)
  }

  @test()
  async search_returnsEmptyWhenNoRowsMatch() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.invoiceFixture.create(project, 10, EInvoiceState.REQUESTED)

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: {
          amountFrom: 9999,
        },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.be.deep.eq([])
    expect(res.data[1]).to.be.eq(0)
  }

  @test()
  async search_rejectsInvalidFilterFieldType() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await invoiceControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          filter: {
            amountFrom: 'invalid' as never,
          },
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
  async search_pagination_byProjectAndAmountSort() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const low = await this.invoiceFixture.create(
      project,
      25,
      EInvoiceState.PAID,
    )
    const high = await this.invoiceFixture.create(
      project,
      100,
      EInvoiceState.PAID,
    )
    const mid = await this.invoiceFixture.create(
      project,
      60,
      EInvoiceState.PAID,
    )

    const first = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { amount: 'ASC' },
        page: 0,
        limit: 2,
      },
      throwOnError: true,
    })
    expect(first.status).to.be.equal(200)

    const second = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { amount: 'ASC' },
        page: 1,
        limit: 2,
      },
      throwOnError: true,
    })
    expect(second.status).to.be.equal(200)

    const slice0 = first.data[0] as unknown as Array<{
      id: string
      amount: string | number
    }>
    const slice1 = second.data[0] as unknown as Array<{
      id: string
      amount: string | number
    }>
    expect(first.data[1]).to.be.eq(3)
    expect(second.data[1]).to.be.eq(3)
    expect(slice0.map((r) => r.id)).to.deep.eq([low.id, mid.id])
    expect(slice1.map((r) => r.id)).to.deep.eq([high.id])
  }

  @test()
  async search_sortByAmount_desc() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const a = await this.invoiceFixture.create(project, 10, EInvoiceState.PAID)
    const b = await this.invoiceFixture.create(project, 99, EInvoiceState.PAID)

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { amount: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as unknown as Array<{
      id: string
      amount: string | number
    }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(b.id)
    expect(rows[1].id).to.be.eq(a.id)
  }

  @test()
  async search_filterByState_onlyRequested() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const requested = await this.invoiceFixture.create(
      project,
      40,
      EInvoiceState.REQUESTED,
    )
    await this.invoiceFixture.create(project, 40, EInvoiceState.PAID)

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          state: EInvoiceState.REQUESTED,
        },
        sort: { amount: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(requested.id)
  }

  @test()
  async search_filterAmountFrom_excludesLowerAmounts() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.invoiceFixture.create(project, 10, EInvoiceState.PAID)
    const high = await this.invoiceFixture.create(
      project,
      75,
      EInvoiceState.PAID,
    )

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          amountFrom: 50,
        },
        sort: { amount: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(high.id)
  }

  @test()
  async search_sortByFromAt_onInvoice() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const older = await this.invoiceFixture.create(
      project,
      20,
      EInvoiceState.PAID,
    )
    const newer = await this.invoiceFixture.create(
      project,
      20,
      EInvoiceState.PAID,
    )

    older.fromAt = new Date(Date.now() - 20 * 86400000)
    older.toAt = new Date(Date.now() - 19 * 86400000)
    newer.fromAt = new Date(Date.now() - 2 * 86400000)
    newer.toAt = new Date(Date.now() - 1 * 86400000)
    await this.invoiceRepository.saveMany([older, newer])

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { fromAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows[0].id).to.be.eq(newer.id)
    expect(rows[1].id).to.be.eq(older.id)
  }

  @test()
  async search_filter_amountTo_only() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const small = await this.invoiceFixture.create(
      project,
      35,
      EInvoiceState.PAID,
    )
    await this.invoiceFixture.create(project, 90, EInvoiceState.PAID)

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id, amountTo: 60 },
        sort: { amount: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(small.id)
  }

  @test()
  async search_filter_invoiceDateWindow_fromAtAndToAt() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const outside = await this.invoiceFixture.create(
      project,
      40,
      EInvoiceState.REQUESTED,
    )
    const inside = await this.invoiceFixture.create(
      project,
      55,
      EInvoiceState.REQUESTED,
    )

    outside.fromAt = new Date(Date.now() - 90 * 86400000)
    outside.toAt = new Date(Date.now() - 89 * 86400000)
    inside.fromAt = new Date(Date.now() - 10 * 86400000)
    inside.toAt = new Date(Date.now() - 9 * 86400000)
    await this.invoiceRepository.saveMany([outside, inside])

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          fromAt: new Date(Date.now() - 15 * 86400000).toISOString(),
          toAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(inside.id)
  }

  @test()
  async search_filter_amountRange_and_state_together() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.invoiceFixture.create(project, 200, EInvoiceState.PAID)
    const wanted = await this.invoiceFixture.create(
      project,
      95,
      EInvoiceState.REQUESTED,
    )

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          amountFrom: 50,
          amountTo: 100,
          state: EInvoiceState.REQUESTED,
        },
        sort: { amount: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(wanted.id)
  }

  @test()
  async search_sortByCreatedAt_asc() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const a = await this.invoiceFixture.create(project, 10, EInvoiceState.PAID)
    await new Promise((resolve) => setTimeout(resolve, 25))
    const b = await this.invoiceFixture.create(project, 10, EInvoiceState.PAID)

    const res = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows[0].id).to.be.eq(a.id)
    expect(rows[1].id).to.be.eq(b.id)
  }
}

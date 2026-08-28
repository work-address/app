import { expect } from 'chai'
import axios from 'axios'
import { faker } from '@faker-js/faker'
import { suite, test } from '@testdeck/mocha'

import { invoiceControllerRead } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EProjectState } from '@/model/project'
import { EInvoiceState } from '@/model/invoice'

@suite()
export class InvoiceControllerTest extends BaseControllerTest {
  @test()
  async read_invoiceOwnedByCurrentUser() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const invoice = await this.invoiceFixture.create(
      project,
      50,
      EInvoiceState.PAID,
    )

    const client = this.apiClient()
    const res = await invoiceControllerRead({
      client,
      path: { id: invoice.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const responseInvoice = res.data as {
      id?: string
      amountCents?: number
      state?: EInvoiceState
      fromAt?: string
      toAt?: string
      project?: { id?: string; title?: string; state?: EProjectState }
    }
    expect(responseInvoice.id).to.be.equal(invoice.id)
    expect(responseInvoice.amountCents).to.be.equal(invoice.amountCents)
    expect(responseInvoice.state).to.be.equal(invoice.state)
    expect(
      new Date(responseInvoice.fromAt as string).toISOString(),
    ).to.be.equal(invoice.fromAt.toISOString())
    expect(new Date(responseInvoice.toAt as string).toISOString()).to.be.equal(
      invoice.toAt.toISOString(),
    )
    const responseProject = responseInvoice.project ?? {}
    expect(responseProject.id).to.be.equal(project.id)
    expect(responseProject.title).to.be.equal(project.title)
    expect(responseProject.state).to.be.equal(project.state)
  }

  @test()
  async read_requiresAuthorization() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const invoice = await this.invoiceFixture.create(
      project,
      50,
      EInvoiceState.PAID,
    )

    let error: unknown

    try {
      await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: invoice.id as never },
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
  async read_deniedForNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const invoice = await this.invoiceFixture.create(
      project,
      50,
      EInvoiceState.PAID,
    )

    let error: unknown

    try {
      await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: invoice.id as never },
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
  }

  @test()
  async read_unknownInvoice_notFound() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: faker.string.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(404)
  }
}

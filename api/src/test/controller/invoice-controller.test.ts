import { expect } from 'chai'
import { skip, suite, test } from '@testdeck/mocha'

import { BaseControllerTest } from './base-controller.test'
import { EProjectState } from '../../interface/project'
import { EInvoiceState } from '../../interface/invoice'

@suite
@skip
export class InvoiceControllerTest extends BaseControllerTest {
  @test
  async getUser() {
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

    const res = await this.http.request({
      url: `${this.url}/api/invoice/${invoice.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.id).to.be.equal(invoice.id)
    expect(res.data.project.id).to.be.equal(project.id)
  }

  @test
  async getOwner() {
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

    const res = await this.http.request({
      url: `${this.url}/api/invoice/${invoice.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.id).to.be.equal(invoice.id)
    expect(res.data.project.id).to.be.equal(project.id)
  }
}

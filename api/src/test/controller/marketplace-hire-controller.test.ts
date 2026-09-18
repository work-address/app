import { randomUUID } from 'crypto'
import axios from 'axios'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { ProjectRepository } from '@/repository/project-repository'
import { WalletAddress } from '@/service/wallet-address'

@suite
export class MarketplaceHireControllerTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private post(body: Record<string, unknown>, signature?: string) {
    const raw = JSON.stringify(body)

    return axios.post(`${this.url}/api/internal/marketplace/hire`, raw, {
      headers: {
        'Content-Type': 'application/json',
        'X-Marketplace-Signature': signature ?? this.signature.sign(raw),
      },
      validateStatus: () => true,
    })
  }

  private body(overrides: Record<string, unknown>) {
    return {
      contractId: randomUUID(),
      clientId: randomUUID(),
      freelancerId: randomUUID(),
      freelancerAddress: null,
      title: 'Payroll dashboard',
      text: 'Build the payroll table',
      rateHour: 45,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
      ...overrides,
    }
  }

  @test
  async hire_createsOneProjectPerContract() {
    const client = await this.userFixture.createUser()
    const freelancer = await this.userFixture.createUser()
    const body = this.body({
      clientId: client.id,
      freelancerId: freelancer.id,
    })

    const first = await this.post(body)
    const retry = await this.post({ ...body, nonce: randomUUID() })
    const project = await this.projectRepository
      .getRepo()
      .findOne({ where: { marketplaceContractId: body.contractId } })

    expect(first.status).to.be.eq(200)
    expect(first.data.created).to.be.true
    expect(retry.data.created).to.be.false
    expect(retry.data.projectId).to.be.eq(first.data.projectId)
    expect(project?.user.id).to.be.eq(client.id)
    expect(project?.title).to.be.eq('Payroll dashboard')
    expect(Number(project?.rateHour)).to.be.eq(45)
    expect(project?.workerAddresses).to.deep.eq([
      WalletAddress.toCanonical(freelancer.address),
    ])
  }

  @test
  async hire_givesTheWorkerAccessWithoutPremium() {
    const client = await this.userFixture.createUser()
    const freelancer = await this.userFixture.createUser()
    const outsider = await this.userFixture.createUser()
    const res = await this.post(
      this.body({ clientId: client.id, freelancerId: freelancer.id }),
    )

    const readAs = (token: string) =>
      axios.get(`${this.url}/api/project/${res.data.projectId}`, {
        headers: { Authorization: token },
        validateStatus: () => true,
      })
    const read = await readAs(
      this.authenticator.getTokens(freelancer).accessToken,
    )
    const denied = await readAs(
      this.authenticator.getTokens(outsider).accessToken,
    )

    expect(client.premium).to.not.be.ok
    expect(read.status).to.be.eq(200)
    expect(denied.status).to.not.be.eq(200)
  }

  @test
  async hire_usesTheGivenAddressForAnUnknownFreelancer() {
    const client = await this.userFixture.createUser()
    const address = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
    const body = this.body({ clientId: client.id, freelancerAddress: address })

    const res = await this.post(body)
    const project = await this.projectRepository
      .getRepo()
      .findOne({ where: { id: res.data.projectId } })

    expect(res.data.created).to.be.true
    expect(project?.workerAddresses).to.deep.eq([
      WalletAddress.toCanonical(address),
    ])
  }

  @test
  async hire_refusesAnUnknownClientAsAConflict() {
    const body = this.body({})
    const res = await this.post(body)
    const projects = await this.projectRepository
      .getRepo()
      .count({ where: { marketplaceContractId: body.contractId } })

    expect(res.status).to.be.eq(409)
    expect(projects).to.be.eq(0)
  }

  @test
  async hire_racingRetriesCreateOneProjectAndOnlyOneSaysCreated() {
    const client = await this.userFixture.createUser()
    const body = this.body({ clientId: client.id })

    const [a, b] = await Promise.all([
      this.post(body),
      this.post({ ...body, nonce: randomUUID() }),
    ])
    const projects = await this.projectRepository
      .getRepo()
      .count({ where: { marketplaceContractId: body.contractId } })

    expect(a.status).to.be.eq(200)
    expect(b.status).to.be.eq(200)
    expect(a.data.projectId).to.be.eq(b.data.projectId)
    expect(projects).to.be.eq(1)
    expect([a.data.created, b.data.created].filter(Boolean)).to.have.length(1)
  }

  @test
  async hire_rejectsBadSignatureStaleCallsAndReplays() {
    const client = await this.userFixture.createUser()
    const body = this.body({ clientId: client.id })

    const forged = await this.post(body, 'deadbeef')
    const stale = await this.post({
      ...body,
      issuedAt: Math.floor(Date.now() / 1000) - 3600,
    })
    const first = await this.post(body)
    const replay = await this.post(body)

    expect(forged.status).to.be.eq(401)
    expect(stale.status).to.be.eq(401)
    expect(first.status).to.be.eq(200)
    expect(replay.status).to.be.eq(401)
  }
}

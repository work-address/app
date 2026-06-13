import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { TonProofService } from '@/service/auth/ton-proof-service'
import {
  buildTonAuthPayload,
  buildTonAuthPayloadWithInvalidSignature,
  getTestTonDomain,
} from '@/test/fixture/ton-auth-fixture'

@suite()
export class TonProofServiceTest extends AbstractDatabaseIntegration {
  protected tonProofService: TonProofService

  constructor() {
    super()

    this.tonProofService = this.container.get('TonProofService')
  }

  @test()
  async checkProof_acceptsValidProof() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = 'test-ton-nonce-valid-proof'
    const { payload } = await buildTonAuthPayload({ nonce, domain })

    const isValid = await this.tonProofService.checkProof(payload)

    expect(isValid).to.be.equal(true)
  }

  @test()
  async checkProof_rejectsInvalidSignature() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = 'test-ton-nonce-invalid-signature'
    const payload = await buildTonAuthPayloadWithInvalidSignature({
      nonce,
      domain,
    })

    const isValid = await this.tonProofService.checkProof(payload)

    expect(isValid).to.be.equal(false)
  }

  @test()
  async checkProof_rejectsWrongDomain() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = 'test-ton-nonce-wrong-domain'
    const { payload } = await buildTonAuthPayload({ nonce, domain })

    payload.proof.domain.value = 'evil.example.com'
    payload.proof.domain.lengthBytes = Buffer.byteLength(
      payload.proof.domain.value,
    )

    const isValid = await this.tonProofService.checkProof(payload)

    expect(isValid).to.be.equal(false)
  }

  @test()
  async checkProof_skipsDomainCheckWhenAllowedDomainsEmpty() {
    const service = new TonProofService()
    service['parameters'] = {
      ...this.parameters,
      tonAllowedDomains: [],
    }

    const nonce = 'test-ton-nonce-no-domain-restriction'
    const { payload } = await buildTonAuthPayload({
      nonce,
      domain: 'evil.example.com',
    })

    const isValid = await service.checkProof(payload)

    expect(isValid).to.be.equal(true)
  }

  @test()
  async checkProof_rejectsExpiredTimestamp() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = 'test-ton-nonce-expired'
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 16 * 60
    const { payload } = await buildTonAuthPayload({
      nonce,
      domain,
      timestamp: expiredTimestamp,
    })

    const isValid = await this.tonProofService.checkProof(payload)

    expect(isValid).to.be.equal(false)
  }

  @test()
  async checkProof_rejectsFutureTimestamp() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = 'test-ton-nonce-future'
    const futureTimestamp = Math.floor(Date.now() / 1000) + 30 * 60
    const { payload } = await buildTonAuthPayload({
      nonce,
      domain,
      timestamp: futureTimestamp,
    })

    const isValid = await this.tonProofService.checkProof(payload)

    expect(isValid).to.be.equal(false)
  }

  @test()
  async checkProof_rejectsMismatchedPublicKey() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = 'test-ton-nonce-wrong-public-key'
    const { payload } = await buildTonAuthPayload({ nonce, domain })

    payload.public_key = '00'.repeat(32)

    const isValid = await this.tonProofService.checkProof(payload)

    expect(isValid).to.be.equal(false)
  }
}

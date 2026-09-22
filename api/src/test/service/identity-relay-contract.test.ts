import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { TypedDataEncoder } from 'ethers'
import { suite, test } from '@testdeck/mocha'

import { EIdentityRelayOperation, IIdentityRelayCall } from '@/model/identity'
import { IdentityRelayer } from '@/service/identity-relayer'

const FIXTURE = path.join(__dirname, '../fixture/relay-action.contract.json')

/** The contracts' own copy, in this repository's contracts workspace. */
const CONTRACTS_FIXTURE = path.resolve(
  __dirname,
  '../../../../contracts/test/fixtures/relay-action.contract.json',
)

interface IIdentityVectors {
  signer: string
  identity: {
    domain: { chainId: number; verifyingContract: string }
    subject: string
    actions: {
      operation: number
      commitment?: string
      schemaId?: number
      expectedVersion: number
      nonce: string
      deadline: number
      payload: string
      digest: string
      signature: string
    }[]
  }
}

/**
 * The relayer's typed data against the vectors app/contracts holds
 * IdentityRegistry to (test/relay-action.contract.test.ts): the payload
 * hash, the EIP-712 digest and the signer it recovers. If any of them drift,
 * the relayer verifies a digest the registry never computes - it would
 * refuse every real authorization, or pass one the chain then reverts.
 */
@suite()
export class IdentityRelayContractTest {
  private readonly vectors = JSON.parse(
    fs.readFileSync(FIXTURE, 'utf8'),
  ) as IIdentityVectors

  @test()
  fixture_isTheContractsCopyByteForByte() {
    expect(fs.readFileSync(FIXTURE, 'utf8')).to.equal(
      fs.readFileSync(CONTRACTS_FIXTURE, 'utf8'),
    )
  }

  @test()
  relayer_buildsThePayloadDigestAndSignerTheRegistryDoes() {
    const { identity, signer } = this.vectors

    expect(identity.actions).to.have.length(2)

    for (const vector of identity.actions) {
      const call = this.callOf(vector)
      const nonce = BigInt(vector.nonce)
      const label = call.operation

      expect(IdentityRelayer.payload(call), label).to.equal(vector.payload)
      expect(
        TypedDataEncoder.hash(
          IdentityRelayer.domain(
            identity.domain.chainId,
            identity.domain.verifyingContract,
          ),
          IdentityRelayer.ACTION_TYPES,
          IdentityRelayer.action(call, nonce),
        ),
        label,
      ).to.equal(vector.digest)
      expect(
        IdentityRelayer.signer(
          call,
          nonce,
          identity.domain.chainId,
          identity.domain.verifyingContract,
        ),
        label,
      ).to.equal(signer)
      // One nonce on, the same signature is someone else's: a replay.
      expect(
        IdentityRelayer.signer(
          call,
          nonce + BigInt(1),
          identity.domain.chainId,
          identity.domain.verifyingContract,
        ),
        label,
      ).to.not.equal(signer)
    }
  }

  private callOf(
    vector: IIdentityVectors['identity']['actions'][number],
  ): IIdentityRelayCall {
    const operation = IdentityRelayer.OPERATIONS[vector.operation]

    return {
      operation,
      subject: this.vectors.identity.subject,
      commitment:
        operation === EIdentityRelayOperation.PUBLISH
          ? (vector.commitment as string)
          : null,
      schemaId:
        operation === EIdentityRelayOperation.PUBLISH
          ? (vector.schemaId as number)
          : null,
      expectedVersion: vector.expectedVersion,
      deadline: vector.deadline,
      signature: vector.signature,
    }
  }
}

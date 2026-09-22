import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { TypedDataEncoder, verifyTypedData } from 'ethers'
import fs from 'node:fs'
import path from 'node:path'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

type Field = { name: string; type: string }

interface IVectors {
  signer: string
  identity: {
    domain: { chainId: number; verifyingContract: string }
    types: { Action: Field[] }
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
  escrow: {
    domain: { chainId: number; verifyingContract: string }
    types: { Action: Field[] }
    allocationId: string
    actions: {
      operation: number
      nonce: string
      deadline: number
      payload: string
      digest: string
      signature: string
    }[]
  }
}

/**
 * The relayed `Action` both contracts verify, written out once as vectors:
 * the typed data, its payload hash, its EIP-712 digest and a signature over
 * it by a key made only for the vectors. The relayers (app/api for
 * identity, web/api for the escrow) and the browsers that sign for them
 * build this typed data by hand, and one wrong field type or order would
 * sign a digest no contract accepts - an error nobody sees until a relay
 * reverts on a live chain.
 *
 * `fixtures/relay-action.contract.json` holds the vectors, and byte-identical
 * copies live wherever an Action is built or checked: app/api and app/web
 * (identity), web/api and web/web (escrow). This test holds the vectors to
 * the contracts; the copies hold their readers to the vectors.
 *
 * The contracts are deployed here, then their runtime code is placed at the
 * vectors' addresses, where OpenZeppelin's EIP712 rebuilds the domain for
 * that address - so each digest is the one the contract computes there.
 */
describe('relayed Action contract', () => {
  const vectors = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures/relay-action.contract.json'), 'utf8'),
  ) as IVectors

  let snapshot: string

  // Code placed at the vectors' addresses - which are where a fresh node's
  // first deployments land - must not outlive this file: another file
  // deploying there would collide with it.
  before(async () => {
    snapshot = await network.provider.send('evm_snapshot', [])
  })

  after(async () => {
    await network.provider.send('evm_revert', [snapshot])
  })

  /** Deploys from Hardhat's last account, whose deployments land nowhere a vector points. */
  async function placed(name: string, address: string, args: unknown[]): Promise<Any> {
    const signers = await ethers.getSigners()
    const factory = await ethers.getContractFactory(name, signers[signers.length - 1])
    const deployed: Any = await factory.deploy(...args)
    const code = await ethers.provider.getCode(await deployed.getAddress())

    await network.provider.send('hardhat_setCode', [address, code])

    return factory.attach(address)
  }

  it("is IdentityRegistry's Action: type hash, payloads and digests", async () => {
    const { identity } = vectors
    const registry = await placed('IdentityRegistry', identity.domain.verifyingContract, [])

    expect(await registry.ACTION_TYPEHASH()).to.equal(
      ethers.id(TypedDataEncoder.from(identity.types).encodeType('Action')),
    )

    for (const action of identity.actions) {
      const payload =
        action.operation === 0
          ? await registry.publishPayload(action.commitment, action.schemaId, action.expectedVersion)
          : await registry.deactivatePayload(action.expectedVersion)

      expect(payload, `payload of operation ${action.operation}`).to.equal(action.payload)
      expect(
        await registry.actionDigest(action.operation, identity.subject, action.payload, action.nonce, action.deadline),
      ).to.equal(action.digest)
      expect(
        verifyTypedData(
          identity.domain,
          identity.types,
          {
            operation: action.operation,
            subject: identity.subject,
            payload: action.payload,
            nonce: action.nonce,
            deadline: action.deadline,
          },
          action.signature,
        ),
      ).to.equal(vectors.signer)
    }
  })

  it("is MarketplaceEscrow's Action: type hash, the submit payload and digests", async () => {
    const { escrow } = vectors
    const [origin, platform] = await ethers.getSigners()
    const signers = await ethers.getSigners()
    const token = await (await ethers.getContractFactory('MockUSDT', signers[signers.length - 1])).deploy()
    const contract = await placed('MarketplaceEscrow', escrow.domain.verifyingContract, [
      await token.getAddress(),
      platform.address,
      origin.address,
    ])

    expect(await contract.ACTION_TYPEHASH()).to.equal(
      ethers.id(TypedDataEncoder.from(escrow.types).encodeType('Action')),
    )

    for (const action of escrow.actions) {
      expect(
        await contract.actionDigest(action.operation, escrow.allocationId, action.payload, action.nonce, action.deadline),
      ).to.equal(action.digest)
      expect(
        verifyTypedData(
          escrow.domain,
          escrow.types,
          {
            operation: action.operation,
            allocationId: escrow.allocationId,
            payload: action.payload,
            nonce: action.nonce,
            deadline: action.deadline,
          },
          action.signature,
        ),
      ).to.equal(vectors.signer)
    }

    // submitInvoiceFor binds keccak256(abi.encode(invoiceCommitment, amount)).
    const submit = escrow.actions.find(({ operation }) => operation === 2) as Any
    const coder = ethers.AbiCoder.defaultAbiCoder()

    expect(
      ethers.keccak256(coder.encode(['bytes32', 'uint256'], [submit.invoiceCommitment, submit.amount])),
    ).to.equal(submit.payload)
  })
})

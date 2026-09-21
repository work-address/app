import fs from 'fs'
import os from 'os'
import path from 'path'
import Ajv from 'ajv'
import { expect } from 'chai'
import hre, { ethers } from 'hardhat'
import { TASK_NODE_SERVER_READY } from 'hardhat/builtin-tasks/task-names'

import type { HardhatRuntimeEnvironment } from 'hardhat/types'

import {
  DEFAULT_LOCAL_RPC_URL,
  DEPLOYMENTS_DIR,
  assertLocalChain,
  deployLocal,
  enableIntervalMining,
  escrowEnvLines,
  localAccountKey,
  localRpcUrl,
  writeManifest,
} from '../scripts/local-chain'
import { mintLocal } from '../scripts/mint'
import { advanceTime, parseDuration } from '../scripts/time-advance'
import { runWalkthrough } from '../scripts/walkthrough'

import type { LocalDeployment } from '../scripts/local-chain'

/**
 * The local chain tooling behind `npm run node`, `deploy:localhost`,
 * `mint:localhost`, `time:advance` and the README walkthrough, run against the
 * in-process Hardhat chain (the same chain id, 31337, as a `hardhat node`).
 */

const USDT = (value: number | string) => ethers.parseUnits(String(value), 6)

const ESCROW_ENV_KEYS = [
  'APP_ESCROW_CHAIN_ID',
  'APP_ESCROW_CONTRACT_ADDRESS',
  'APP_ESCROW_TOKEN_ADDRESS',
  'APP_ESCROW_ORIGIN_SIGNER_KEY',
  'APP_ESCROW_ORIGIN_TTL_SECONDS',
]

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  } catch (error) {
    return error as Error
  }

  throw new Error('Expected a rejection')
}

/** A runtime connected to Ethereum mainnet that fails the test if anything past the chain id is used. */
function mainnetRuntime(calls: string[]): HardhatRuntimeEnvironment {
  const unreachable = new Proxy(
    {},
    {
      get: (_target, property) => {
        throw new Error(`ethers.${String(property)} must not be reached on mainnet`)
      },
    },
  )

  return {
    config: hre.config,
    network: {
      name: 'mainnet',
      provider: {
        request: async ({ method }: { method: string }) => {
          calls.push(method)

          if (method === 'eth_chainId') {
            return '0x1'
          }

          throw new Error(`${method} must not be reached on mainnet`)
        },
      },
    },
    ethers: unreachable,
  } as unknown as HardhatRuntimeEnvironment
}

describe('local chain tooling', () => {
  let dir: string
  let file: string
  let manifest: LocalDeployment

  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-address-local-chain-'))
    file = path.join(dir, 'localhost.json')
  })

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  describe('chain guard', () => {
    it('refuses Ethereum mainnet by name', () => {
      expect(() => assertLocalChain(1)).to.throw(/chainId 1 \(Ethereum mainnet\)/)
      expect(() => assertLocalChain(BigInt(1))).to.throw(/Ethereum mainnet/)
    })

    it('refuses every other chain, testnets included', () => {
      for (const chainId of [11155111, 137, 31338]) {
        expect(() => assertLocalChain(chainId)).to.throw(`Refusing chainId ${chainId}`)
      }
    })

    it('accepts the local Hardhat chain', () => {
      expect(() => assertLocalChain(31337)).not.to.throw()
      expect(() => assertLocalChain(BigInt(31337))).not.to.throw()
    })

    it('deploy, mint and time:advance ask for the chain id first and stop on mainnet', async () => {
      const calls: string[] = []
      const mainnet = mainnetRuntime(calls)
      const someone = ethers.Wallet.createRandom().address

      for (const attempt of [
        deployLocal(mainnet),
        mintLocal(mainnet, { to: someone, amount: '1', manifest: file }),
        advanceTime(mainnet, 60),
      ]) {
        expect((await rejection(attempt)).message).to.match(/Ethereum mainnet/)
      }

      expect(calls).to.deep.eq(['eth_chainId', 'eth_chainId', 'eth_chainId'])
    })
  })

  describe('node', () => {
    it('keeps an idle node mining once started, so chain time moves without transactions', async () => {
      const provider = hre.network.provider
      const start = await ethers.provider.getBlockNumber()

      await enableIntervalMining(provider, 100)

      try {
        await new Promise((resolve) => setTimeout(resolve, 450))
        expect(await ethers.provider.getBlockNumber()).to.be.greaterThan(start)
      } finally {
        await enableIntervalMining(provider, 0)
      }
    })

    it('`npm run node` turns interval mining on once the server is up', async () => {
      const requests: { method: string; params?: unknown[] }[] = []
      const log = console.log

      console.log = () => undefined

      try {
        await hre.run(TASK_NODE_SERVER_READY, {
          address: '127.0.0.1',
          port: 8545,
          provider: {
            request: async (request: { method: string; params?: unknown[] }) => {
              requests.push(request)
            },
          },
          server: {},
        })
      } finally {
        console.log = log
      }

      expect(requests).to.deep.eq([{ method: 'evm_setIntervalMining', params: [5_000] }])
    })

    it('answers on 8545 unless LOCAL_RPC_URL names another node', () => {
      expect(localRpcUrl({})).to.eq(DEFAULT_LOCAL_RPC_URL)
      expect(localRpcUrl({ LOCAL_RPC_URL: '' })).to.eq(DEFAULT_LOCAL_RPC_URL)
      expect(localRpcUrl({ LOCAL_RPC_URL: '  ' })).to.eq(DEFAULT_LOCAL_RPC_URL)
      expect(localRpcUrl({ LOCAL_RPC_URL: ' http://127.0.0.1:8546 ' })).to.eq(
        'http://127.0.0.1:8546',
      )
    })
  })

  describe('deploy', () => {
    before(async () => {
      const [deployer] = await ethers.getSigners()
      const nonce = await ethers.provider.getTransactionCount(deployer.address)

      manifest = await deployLocal(hre)
      writeManifest(file, manifest)

      // In nonce order, so a fresh node always yields the same addresses.
      expect([
        manifest.token.address,
        manifest.escrow.address,
        manifest.identityRegistry.address,
      ]).to.deep.eq(
        [0, 1, 2].map((offset) =>
          ethers.getCreateAddress({ from: deployer.address, nonce: nonce + offset }),
        ),
      )
    })

    it('installs TetherLikeUSDT by default, so the approve-reset rule is live', async () => {
      const [, , , holder, spender] = await ethers.getSigners()
      const token = await ethers.getContractAt('TetherLikeUSDT', manifest.token.address, holder)

      expect(manifest.token).to.deep.eq({
        contract: 'TetherLikeUSDT',
        address: manifest.token.address,
        decimals: 6,
      })
      expect(await token.decimals()).to.eq(BigInt(6))

      await token.approve(spender.address, 1)
      await expect(token.approve(spender.address, 2)).to.be.reverted
      await token.approve(spender.address, 0)
    })

    it('wires the escrow to that token and the manifest roles', async () => {
      const [deployer, feeRecipient, originSigner] = await ethers.getSigners()
      const escrow = await ethers.getContractAt('MarketplaceEscrow', manifest.escrow.address)

      expect(await escrow.token()).to.eq(manifest.token.address)
      expect(await escrow.feeRecipient()).to.eq(feeRecipient.address)
      expect(await escrow.originSigner()).to.eq(originSigner.address)
      expect(manifest).to.include({
        network: 'hardhat',
        chainId: 31337,
        deployer: deployer.address,
        feeRecipient: feeRecipient.address,
        originSigner: originSigner.address,
      })
    })

    it('deploys the IdentityRegistry too', async () => {
      const registry = await ethers.getContractAt(
        'IdentityRegistry',
        manifest.identityRegistry.address,
      )

      expect(manifest.identityRegistry.contract).to.eq('IdentityRegistry')
      expect(await registry.SUBJECT_SCHEME()).to.eq('did:pkh:eip155')
    })

    it('records the first block holding the contracts as deployBlock', async () => {
      const { deployBlock } = manifest

      expect(await ethers.provider.getCode(manifest.token.address, deployBlock - 1)).to.eq('0x')
      expect(await ethers.provider.getCode(manifest.token.address, deployBlock)).not.to.eq('0x')
      expect(await ethers.provider.getCode(manifest.escrow.address, deployBlock - 1)).to.eq('0x')
      expect(
        await ethers.provider.getCode(manifest.identityRegistry.address, deployBlock - 1),
      ).to.eq('0x')
    })

    it('writes a manifest that validates against deployments/manifest.schema.json', () => {
      const schema = JSON.parse(
        fs.readFileSync(path.join(DEPLOYMENTS_DIR, 'manifest.schema.json'), 'utf8'),
      )
      const validate = new Ajv({ allErrors: true, strict: true }).compile(schema)
      const written = JSON.parse(fs.readFileSync(file, 'utf8'))
      const withoutRegistry = { ...written, identityRegistry: undefined }

      expect(validate(written), JSON.stringify(validate.errors)).to.eq(true)
      expect(validate({ ...written, chainId: 1 })).to.eq(false)
      expect(validate({ ...written, chainId: 11155111 })).to.eq(false)
      expect(validate(withoutRegistry)).to.eq(false)
      expect(validate({ ...written, deployBlock: 1.5 })).to.eq(false)
      expect(validate({ ...written, escrow: { ...written.escrow, address: '0x1234' } })).to.eq(
        false,
      )
    })

    it('can install the plain MockUSDT instead', async () => {
      const mock = await deployLocal(hre, { token: 'MockUSDT' })
      const token = await ethers.getContractAt('MockUSDT', mock.token.address)

      expect(mock.token.contract).to.eq('MockUSDT')
      expect(await token.name()).to.eq('Mock Tether USD')
    })

    it('prints the APP_ESCROW_* lines web/api reads, with the key that controls the origin signer', () => {
      const key = localAccountKey(hre, manifest.originSigner)
      const lines = escrowEnvLines(manifest, key)
      const env = Object.fromEntries(lines.map((line) => line.split('=')))

      expect(Object.keys(env)).to.deep.eq(ESCROW_ENV_KEYS)
      expect(env.APP_ESCROW_CHAIN_ID).to.eq('31337')
      expect(env.APP_ESCROW_CONTRACT_ADDRESS).to.eq(manifest.escrow.address)
      expect(env.APP_ESCROW_TOKEN_ADDRESS).to.eq(manifest.token.address)
      expect(new ethers.Wallet(env.APP_ESCROW_ORIGIN_SIGNER_KEY).address).to.eq(
        manifest.originSigner,
      )
      expect(Number(env.APP_ESCROW_ORIGIN_TTL_SECONDS)).to.be.greaterThan(0)
    })

    it('never prints a key for an address the node does not hold', () => {
      const stranger = ethers.Wallet.createRandom().address

      expect(localAccountKey(hre, stranger)).to.eq(null)
      expect(escrowEnvLines({ ...manifest, originSigner: stranger }, null)[3]).to.eq(
        `APP_ESCROW_ORIGIN_SIGNER_KEY=<private key of ${stranger}>`,
      )
    })
  })

  describe('mint', () => {
    it('gives any address test USDT and enough ETH for gas', async () => {
      const wallet = ethers.Wallet.createRandom().address
      const token = await ethers.getContractAt('TetherLikeUSDT', manifest.token.address)

      await hre.run('mint', { to: wallet, amount: '1000', manifest: file })

      expect(await token.balanceOf(wallet)).to.eq(USDT(1000))
      expect(await ethers.provider.getBalance(wallet)).to.eq(ethers.parseEther('10'))

      const again = await mintLocal(hre, { to: wallet, amount: '12.5', manifest: file })

      expect(again.balance).to.eq(USDT('1012.5'))
      expect(again.gasToppedUp).to.eq(false)
    })

    it('refuses a bad address, a non-positive amount and a missing manifest', async () => {
      const wallet = ethers.Wallet.createRandom().address

      const mintError = async (to: string, amount: string, manifest = file) =>
        (await rejection(mintLocal(hre, { to, amount, manifest }))).message

      expect(await mintError('nobody', '1')).to.match(/invalid address/)
      expect(await mintError(wallet, '0')).to.match(/Cannot mint 0/)
      expect(await mintError(wallet, '1', path.join(dir, 'none.json'))).to.match(
        /deploy:localhost/,
      )
    })

    it('refuses a manifest written for mainnet or for a node that has since restarted', async () => {
      const wallet = ethers.Wallet.createRandom().address
      const mainnetFile = path.join(dir, 'mainnet.json')
      const staleFile = path.join(dir, 'stale.json')

      writeManifest(mainnetFile, { ...manifest, chainId: 1 })
      writeManifest(staleFile, {
        ...manifest,
        token: { ...manifest.token, address: ethers.Wallet.createRandom().address },
      })

      const mintError = async (manifest: string) =>
        (await rejection(mintLocal(hre, { to: wallet, amount: '1', manifest }))).message

      expect(await mintError(mainnetFile)).to.match(/Ethereum mainnet/)
      expect(await mintError(staleFile)).to.match(/restarted/)
    })
  })

  describe('time:advance', () => {
    it('reads seconds and s / m / h / d durations', () => {
      expect(parseDuration('90')).to.eq(90)
      expect(parseDuration('90s')).to.eq(90)
      expect(parseDuration('15m')).to.eq(900)
      expect(parseDuration('72h')).to.eq(259_200)
      expect(parseDuration('8d')).to.eq(691_200)

      for (const bad of ['', '0', '-5', '1.5h', '3w', 'soon']) {
        expect(() => parseDuration(bad), bad).to.throw(/Cannot read/)
      }
    })

    it('mines one block carrying the new time', async () => {
      const before = (await ethers.provider.getBlock('latest'))!

      await hre.run('time:advance', { duration: '2h' })

      const after = (await ethers.provider.getBlock('latest'))!

      expect(after.number).to.eq(before.number + 1)
      expect(after.timestamp).to.be.gte(before.timestamp + 7_200)
      expect(after.timestamp).to.be.lt(before.timestamp + 7_200 + 60)
    })
  })

  describe('README walkthrough', () => {
    it('fund, advance, submit, advance, release ends 95 / 5, and the unbilled 20 goes back', async () => {
      const lines: string[] = []
      const result = await runWalkthrough(hre, {
        manifest: file,
        log: (line) => lines.push(line),
      })
      const escrow = await ethers.getContractAt('MarketplaceEscrow', manifest.escrow.address)
      const token = await ethers.getContractAt('TetherLikeUSDT', manifest.token.address)
      const allocation = await escrow.readAllocation(result.allocationId)

      expect(lines.map((line) => line.split(/\s+/)[1])).to.deep.eq([
        'fund',
        'advance',
        'submit',
        'advance',
        'release',
      ])
      expect(result.budget).to.eq(USDT(120))
      expect(result.billed).to.eq(USDT(100))
      expect(result.workerReceived).to.eq(USDT(95))
      expect(result.feeReceived).to.eq(USDT(5))
      expect(result.clientRefunded).to.eq(USDT(20))
      expect(result.clientSpent).to.eq(USDT(100))
      expect(allocation.state).to.eq(BigInt(6)) // Released
      expect(allocation.remainderRefunded).to.eq(true)
      expect(await escrow.heldOf(result.allocationId)).to.eq(BigInt(0))
      expect(await token.balanceOf(manifest.escrow.address)).to.eq(await escrow.totalHeld())
    })
  })
})

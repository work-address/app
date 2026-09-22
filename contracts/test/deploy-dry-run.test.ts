import fs from 'fs'
import path from 'path'
import Ajv from 'ajv'
import { expect } from 'chai'
import hre, { ethers } from 'hardhat'
import { createProvider } from 'hardhat/internal/core/providers/construction'

import type { EIP1193Provider, HardhatRuntimeEnvironment } from 'hardhat/types'

import { publicEscrowEnvLines, runDeploy, runDryRun, sepoliaNetwork } from '../scripts/deploy-command'
import { assertDeployTarget, codeHashes, dryRunDeploy, rolesFromEnv } from '../scripts/deployment'
import { DEPLOYMENTS_DIR, deployLocal } from '../scripts/local-chain'

import type { DeploymentManifest } from '../scripts/deployment'

import { startRpcBridge } from './helpers/rpc-bridge'

import type { RpcBridge } from './helpers/rpc-bridge'

/**
 * The public-network half of the deploy: the Sepolia entry, the guard that
 * keeps every chain but 31337 out unless confirmed (and mainnet out
 * regardless), and the dry run that rehearses a deploy on an in-process fork.
 *
 * No test here reaches a public network. The dry run forks a second local
 * Hardhat chain served on a loopback port, which stands in for the public
 * one; the variant against a real endpoint runs only when DRY_RUN_FORK_URL is
 * set, and nothing in this repository sets it.
 */

const SEPOLIA = 11155111

/** Everything a fork may ask the chain it forks. A method outside this list would change that chain. */
const READ_ONLY_METHODS = new Set([
  'eth_chainId',
  'net_version',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getLogs',
  'eth_call',
])

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  } catch (error) {
    return error as Error
  }

  throw new Error('Expected a rejection')
}

/** A second in-process Hardhat chain, apart from the one every other suite shares. */
function freshChain(): Promise<EIP1193Provider> {
  return createProvider(hre.config, 'hardhat', hre.artifacts)
}

/** An address nobody holds a key for, so the dry run has to impersonate it. */
function keylessAddress(): string {
  return ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)))
}

/**
 * A runtime whose endpoint answers as `chainId` and fails the test on any
 * other request, with the network config the caller gives.
 */
function publicRuntime(
  chainId: number,
  calls: string[],
  networkConfig: Record<string, unknown> = { url: 'https://rpc.invalid', accounts: [] },
): HardhatRuntimeEnvironment {
  const unreachable = new Proxy(
    {},
    {
      get: (_target, property) => {
        throw new Error(`ethers.${String(property)} must not be reached`)
      },
    },
  )

  return {
    config: hre.config,
    artifacts: hre.artifacts,
    network: {
      name: 'sepolia',
      config: networkConfig,
      provider: {
        request: async ({ method }: { method: string }) => {
          calls.push(method)

          if (method === 'eth_chainId') {
            return ethers.toQuantity(chainId)
          }

          throw new Error(`${method} must not be sent to a public chain`)
        },
      },
    },
    ethers: unreachable,
  } as unknown as HardhatRuntimeEnvironment
}

const quiet = () => undefined

describe('deploy: public networks and the fork dry run', () => {
  describe('chain guard', () => {
    it('deploys to the local chain unasked', () => {
      expect(assertDeployTarget(31337)).to.eq('local')
      expect(assertDeployTarget(BigInt(31337), undefined)).to.eq('local')
    })

    it('refuses Sepolia without a confirmation, and with one naming another chain', () => {
      expect(() => assertDeployTarget(SEPOLIA)).to.throw(/without confirmation.*--confirm-chain-id 11155111/)
      expect(() => assertDeployTarget(SEPOLIA, '')).to.throw(/without confirmation/)
      expect(() => assertDeployTarget(SEPOLIA, '31337')).to.throw(/confirmation names chain 31337/)
      expect(assertDeployTarget(SEPOLIA, '11155111')).to.eq('public')
      expect(assertDeployTarget(SEPOLIA, SEPOLIA)).to.eq('public')
    })

    it('refuses mainnet whatever is confirmed', () => {
      for (const confirmation of [undefined, '1', 1, '11155111']) {
        expect(() => assertDeployTarget(1, confirmation)).to.throw(/chainId 1 \(Ethereum mainnet\).*no flag lifts that/)
      }
    })

    it('refuses every chain it has no manifest form for, confirmed or not', () => {
      for (const chainId of [137, 10, 31338, 5]) {
        expect(() => assertDeployTarget(chainId, String(chainId))).to.throw(`Refusing chainId ${chainId}`)
      }
    })
  })

  describe('the sepolia network entry', () => {
    it('takes its URL and deployer key from the environment only', () => {
      const key = ethers.Wallet.createRandom().privateKey

      expect(sepoliaNetwork({})).to.deep.eq({ url: '', chainId: SEPOLIA, accounts: [] })
      expect(sepoliaNetwork({ SEPOLIA_RPC_URL: ' https://rpc.example/v1 ', DEPLOYER_KEY: ` ${key} ` })).to.deep.eq({
        url: 'https://rpc.example/v1',
        chainId: SEPOLIA,
        accounts: [key],
      })
    })

    it('is configured, pinned to Sepolia', () => {
      const sepolia = hre.config.networks.sepolia as { url: string; chainId?: number }

      expect(sepolia.chainId).to.eq(SEPOLIA)
      expect(sepolia.url).to.eq((process.env.SEPOLIA_RPC_URL ?? '').trim())
    })

    it('has no URL or key committed anywhere in the package', () => {
      const config = fs.readFileSync(path.join(__dirname, '..', 'hardhat.config.ts'), 'utf8')

      expect(config).to.match(/sepolia: sepoliaNetwork\(process\.env\)/)
      expect(config).not.to.match(/https?:\/\/(?!127\.0\.0\.1)[^\s'"]*(infura|alchemy|sepolia)/i)
      expect(config).not.to.match(/0x[0-9a-fA-F]{64}/)
    })

    it('reads the two escrow roles from the environment, and never a key', () => {
      const [feeRecipient, originSigner] = [keylessAddress(), keylessAddress()]

      expect(rolesFromEnv({ FEE_RECIPIENT: feeRecipient.toLowerCase(), ORIGIN_SIGNER_ADDRESS: ` ${originSigner} ` })).to.deep.eq({
        feeRecipient,
        originSigner,
      })
      expect(() => rolesFromEnv({ ORIGIN_SIGNER_ADDRESS: originSigner })).to.throw(/FEE_RECIPIENT is not set/)
      expect(() => rolesFromEnv({ FEE_RECIPIENT: feeRecipient })).to.throw(/ORIGIN_SIGNER_ADDRESS is not set/)
      expect(() => rolesFromEnv({ FEE_RECIPIENT: feeRecipient, ORIGIN_SIGNER_ADDRESS: ethers.ZeroAddress })).to.throw(
        /not an address/,
      )
    })
  })

  describe('deploy:contracts against a public chain', () => {
    const roles = { FEE_RECIPIENT: keylessAddress(), ORIGIN_SIGNER_ADDRESS: keylessAddress() }

    it('asks for nothing without a URL', async () => {
      const calls: string[] = []
      const runtime = publicRuntime(SEPOLIA, calls, { url: '', accounts: [] })
      const error = await rejection(runDeploy(runtime, { confirmChainId: '11155111', env: roles, log: quiet }))

      expect(error.message).to.match(/no URL: set SEPOLIA_RPC_URL/)
      expect(calls).to.deep.eq([])
    })

    it('stops after the chain id without the confirmation flag', async () => {
      const calls: string[] = []
      const error = await rejection(runDeploy(publicRuntime(SEPOLIA, calls), { env: roles, log: quiet }))

      expect(error.message).to.match(/without confirmation/)
      expect(calls).to.deep.eq(['eth_chainId'])
    })

    it('stops when the endpoint answers as another chain than the one confirmed', async () => {
      const calls: string[] = []
      const error = await rejection(runDeploy(publicRuntime(137, calls), { confirmChainId: '11155111', env: roles, log: quiet }))

      expect(error.message).to.match(/Refusing chainId 137/)
      expect(calls).to.deep.eq(['eth_chainId'])
    })

    it('stops on mainnet with a confirmation that names it', async () => {
      const calls: string[] = []
      const error = await rejection(runDeploy(publicRuntime(1, calls), { confirmChainId: '1', env: roles, log: quiet }))

      expect(error.message).to.match(/Ethereum mainnet/)
      expect(calls).to.deep.eq(['eth_chainId'])
    })

    it('confirmed, still sends nothing without the roles or the deployer key', async () => {
      const calls: string[] = []
      const runtime = publicRuntime(SEPOLIA, calls)

      expect((await rejection(runDeploy(runtime, { confirmChainId: '11155111', env: {}, log: quiet }))).message).to.match(
        /FEE_RECIPIENT is not set/,
      )
      expect((await rejection(runDeploy(runtime, { confirmChainId: '11155111', env: roles, log: quiet }))).message).to.match(
        /DEPLOYER_KEY is not set/,
      )
      expect(calls).to.deep.eq(['eth_chainId', 'eth_chainId'])
    })
  })

  describe('dry run on a fork of a local chain', () => {
    let source: EIP1193Provider
    let bridge: RpcBridge
    let deployer: string
    let sourceNonce: number
    let sourceBlock: number
    let first: DeploymentManifest
    let second: DeploymentManifest

    before(async () => {
      source = await freshChain()
      deployer = keylessAddress()

      // Give the stand-in public chain some history of its own: the deployer
      // has sent two transactions there, so a rehearsal that did not read its
      // nonce from the fork would predict the wrong addresses.
      await source.request({ method: 'hardhat_impersonateAccount', params: [deployer] })
      await source.request({ method: 'hardhat_setBalance', params: [deployer, ethers.toQuantity(ethers.parseEther('0.5'))] })

      for (let i = 0; i < 2; i++) {
        await source.request({
          method: 'eth_sendTransaction',
          params: [{ from: deployer, to: keylessAddress(), value: '0x1' }],
        })
      }

      await source.request({ method: 'hardhat_stopImpersonatingAccount', params: [deployer] })
      sourceNonce = Number(BigInt((await source.request({ method: 'eth_getTransactionCount', params: [deployer, 'latest'] })) as string))
      sourceBlock = Number(BigInt((await source.request({ method: 'eth_blockNumber' })) as string))
      bridge = await startRpcBridge(source)

      first = await dryRunDeploy(await freshChain(), hre.artifacts, { forkUrl: bridge.url, deployer })
      second = await dryRunDeploy(await freshChain(), hre.artifacts, { forkUrl: bridge.url, deployer })
    })

    after(async () => {
      await bridge?.close()
    })

    it('records the fork it ran on and a manifest the schema accepts', () => {
      const schema = JSON.parse(fs.readFileSync(path.join(DEPLOYMENTS_DIR, 'manifest.schema.json'), 'utf8'))
      const validate = new Ajv({ allErrors: true, strict: true }).compile(schema)

      expect(validate(first), JSON.stringify(validate.errors)).to.eq(true)
      expect(first.dryRun).to.deep.eq({ forkBlock: sourceBlock, simulatedChainId: 31337, gasSimulated: true })
      expect(first).to.include({ network: 'chain-31337', chainId: 31337, deployer })
      expect(first.token).to.include({ contract: 'TetherLikeUSDT', decimals: 6, mock: true })
    })

    it("predicts the addresses from the deployer's nonce on the forked chain", () => {
      expect(sourceNonce).to.eq(2)
      expect([first.token.address, first.escrow.address, first.identityRegistry.address]).to.deep.eq(
        [0, 1, 2].map((offset) => ethers.getCreateAddress({ from: deployer, nonce: sourceNonce + offset })),
      )
    })

    it('reproduces every address and bytecode hash on a second run', () => {
      expect(second).to.deep.eq(first)
    })

    it('hashes the compiled code, the same on any chain and at any address', async () => {
      const local = await deployLocal(hre)

      for (const [name, entry] of [
        ['TetherLikeUSDT', 'token'],
        ['MarketplaceEscrow', 'escrow'],
        ['IdentityRegistry', 'identityRegistry'],
      ] as const) {
        const artifact = await hre.artifacts.readArtifact(name)

        expect(first[entry].creationCodeHash, name).to.eq(ethers.keccak256(artifact.bytecode))
        expect(first[entry].runtimeCodeHash, name).to.eq(ethers.keccak256(artifact.deployedBytecode))
        expect(local[entry].runtimeCodeHash, name).to.eq(first[entry].runtimeCodeHash)
        expect(local[entry].address, name).not.to.eq(first[entry].address)
      }

      expect(first.compiler).to.deep.eq({
        solc: (await hre.artifacts.getBuildInfo('contracts/MarketplaceEscrow.sol:MarketplaceEscrow'))!.solcLongVersion,
        optimizer: { enabled: true, runs: 200 },
        evmVersion: 'cancun',
      })
    })

    it('refuses to hash code that is not the compiled contract', async () => {
      const code = await ethers.provider.getCode((await deployLocal(hre)).escrow.address)
      const tampered = `${code.slice(0, -2)}${code.slice(-2) === '00' ? '01' : '00'}`

      expect((await rejection(codeHashes(hre.artifacts, 'MarketplaceEscrow', tampered))).message).to.match(
        /is not the compiled contracts\/MarketplaceEscrow\.sol:MarketplaceEscrow/,
      )
    })

    it('never sends the forked chain anything but reads', async () => {
      const unexpected = bridge.methods.filter((method) => !READ_ONLY_METHODS.has(method))

      expect(bridge.methods).to.include('eth_getTransactionCount')
      expect(unexpected, unexpected.join(', ')).to.deep.eq([])
      expect(Number(BigInt((await source.request({ method: 'eth_blockNumber' })) as string))).to.eq(sourceBlock)
      expect(
        Number(BigInt((await source.request({ method: 'eth_getTransactionCount', params: [deployer, 'latest'] })) as string)),
      ).to.eq(sourceNonce)

      for (const address of [first.token.address, first.escrow.address, first.identityRegistry.address]) {
        expect(await source.request({ method: 'eth_getCode', params: [address, 'latest'] })).to.eq('0x')
      }
    })

    it('wires the rehearsed escrow as the real one would be', async () => {
      const fork = await freshChain()
      const [feeRecipient, originSigner] = [keylessAddress(), keylessAddress()]
      const manifest = await dryRunDeploy(fork, hre.artifacts, {
        forkUrl: bridge.url,
        deployer,
        roles: { feeRecipient, originSigner },
      })
      const escrow = new ethers.Contract(
        manifest.escrow.address,
        ['function token() view returns (address)', 'function feeRecipient() view returns (address)', 'function originSigner() view returns (address)'],
        new ethers.BrowserProvider(fork),
      )

      expect(await escrow.token()).to.eq(manifest.token.address)
      expect(await escrow.feeRecipient()).to.eq(feeRecipient)
      expect(await escrow.originSigner()).to.eq(originSigner)
      expect(manifest).to.include({ feeRecipient, originSigner })
    })

    it("prints web/api's lines for a public deployment with the origin signer through a KMS, and no key", () => {
      const env = Object.fromEntries(publicEscrowEnvLines({ ...first, chainId: SEPOLIA }).map((line) => line.split(/=(.*)/s, 2)))

      expect(env).to.include({
        APP_ESCROW_CHAIN_ID: '11155111',
        APP_ESCROW_CONTRACT_ADDRESS: first.escrow.address,
        APP_ESCROW_TOKEN_ADDRESS: first.token.address,
        APP_ESCROW_ORIGIN_SIGNER: 'kms',
        APP_ESCROW_ORIGIN_SIGNER_ADDRESS: first.originSigner,
        APP_ESCROW_DEPLOY_BLOCK: String(first.deployBlock),
      })
      expect(Object.keys(env)).not.to.include('APP_ESCROW_ORIGIN_SIGNER_KEY')
      expect(Object.values(env).join(' ')).not.to.match(/0x[0-9a-fA-F]{64}/)
    })

    it('refuses to rehearse on mainnet, before forking anything', async () => {
      const mainnet = await startRpcBridge(source, (method) => (method === 'eth_chainId' ? '0x1' : undefined))
      const fork = await freshChain()
      const calls: string[] = []
      const watched: EIP1193Provider = {
        request: (request) => {
          calls.push(request.method)
          return fork.request(request)
        },
      } as EIP1193Provider

      try {
        expect((await rejection(dryRunDeploy(watched, hre.artifacts, { forkUrl: mainnet.url }))).message).to.match(
          /Refusing to rehearse on Ethereum mainnet/,
        )
        expect(mainnet.methods).to.deep.eq(['eth_chainId'])
        expect(calls).to.deep.eq([])
      } finally {
        await mainnet.close()
      }
    })

    it('deploy:dry-run needs a fork URL and the in-process network', async () => {
      const calls: string[] = []

      expect((await rejection(runDryRun(hre, { env: {}, log: quiet }))).message).to.match(/No fork URL: set DRY_RUN_FORK_URL/)
      expect((await rejection(runDryRun(hre, { forkUrl: bridge.url, block: 'latest', env: {}, log: quiet }))).message).to.match(
        /--block is a block number, not latest/,
      )
      expect(
        (await rejection(runDryRun(publicRuntime(SEPOLIA, calls), { forkUrl: bridge.url, env: {}, log: quiet }))).message,
      ).to.match(/in-process network only, not sepolia/)
      expect(calls).to.deep.eq([])
    })
  })

  describe('dry run against DRY_RUN_FORK_URL', () => {
    const forkUrl = (process.env.DRY_RUN_FORK_URL ?? '').trim()
    const title =
      forkUrl === ''
        ? 'rehearses the deploy on the configured network (skipped: DRY_RUN_FORK_URL is not set, and nothing here sets it)'
        : 'rehearses the deploy on the network at DRY_RUN_FORK_URL, reading only'

    it(title, async function () {
      if (forkUrl === '') {
        this.skip()
      }

      this.timeout(300_000)

      const deployer = (process.env.DEPLOYER_ADDRESS ?? '').trim() || undefined
      const first = await dryRunDeploy(await freshChain(), hre.artifacts, { forkUrl, deployer })
      const second = await dryRunDeploy(await freshChain(), hre.artifacts, {
        forkUrl,
        deployer,
        blockNumber: first.dryRun!.forkBlock,
      })

      expect(second).to.deep.eq(first)
    })
  })
})

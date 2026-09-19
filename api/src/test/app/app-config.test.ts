import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { AppConfig } from '@/app/app-config'

const IDENTITY_KEYS = [
  'APP_IDENTITY_CHAIN_ID',
  'APP_IDENTITY_REGISTRY_ADDRESS',
  'APP_IDENTITY_RPC_URL',
  'APP_IDENTITY_MANIFEST_URL',
  'APP_IDENTITY_DEPLOY_BLOCK',
]

@suite()
export class AppConfigTest {
  private savedEnv: Record<string, string | undefined> = {}

  before() {
    for (const key of IDENTITY_KEYS) {
      this.savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  }

  after() {
    for (const key of IDENTITY_KEYS) {
      if (this.savedEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = this.savedEnv[key]
      }
    }
  }

  @test()
  parameters() {
    const params = AppConfig.readConfig()

    expect(params).to.be.an.instanceOf(Object)
    expect(params).to.contain.keys(['host', 'port'])
  }

  @test()
  identity_unsetReadsAsNothingConfigured() {
    expect(AppConfig.readConfig().identity).to.deep.equal({
      chainId: null,
      registryAddress: '',
      rpcUrl: '',
      manifestUrl: '',
      deployBlock: 0,
    })
  }

  @test()
  identity_readsTrimmedValues() {
    process.env.APP_IDENTITY_CHAIN_ID = ' 31337 '
    process.env.APP_IDENTITY_REGISTRY_ADDRESS =
      ' 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 '
    process.env.APP_IDENTITY_RPC_URL = ' http://127.0.0.1:8545 '
    process.env.APP_IDENTITY_MANIFEST_URL = ' https://example.test/m.json '
    process.env.APP_IDENTITY_DEPLOY_BLOCK = ' 1234 '

    expect(AppConfig.readConfig().identity).to.deep.equal({
      chainId: 31337,
      registryAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      rpcUrl: 'http://127.0.0.1:8545',
      manifestUrl: 'https://example.test/m.json',
      deployBlock: 1234,
    })
  }

  @test()
  identity_aDeployBlockThatIsNotABlockNumberScansFromGenesis() {
    for (const raw of ['-1', '1.5', '0x10', 'latest', '']) {
      process.env.APP_IDENTITY_DEPLOY_BLOCK = raw

      expect(AppConfig.readConfig().identity.deployBlock, raw).to.equal(0)
    }
  }

  @test()
  identity_aChainIdThatIsNotAPositiveIntegerIsUnset() {
    for (const raw of ['0', '-1', '1.5', '0x7a69', 'mainnet', '01', '1e3']) {
      process.env.APP_IDENTITY_CHAIN_ID = raw

      expect(AppConfig.readConfig().identity.chainId, raw).to.equal(null)
    }
  }
}

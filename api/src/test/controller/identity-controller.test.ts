import { expect } from 'chai'
import { suite, test, timeout } from '@testdeck/mocha'

import { identityControllerConfig } from '@app/api-client'

import { IConfigParameters } from '@/model/config'
import { BaseControllerTest } from '@/test/controller/base-controller.test'

/** Hardhat's first deployment addresses, as the local deploy prints them. */
const REGISTRY_LOWER = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0'
const REGISTRY_EIP55 = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
const RPC_URL = 'http://127.0.0.1:8545/secret-provider-key'
const MANIFEST_URL = 'https://example.test/deployments/localhost.json'

@suite()
export class IdentityControllerTest extends BaseControllerTest {
  private saved: IConfigParameters['identity']

  @timeout(10000)
  async before() {
    await super.before()
    this.saved = { ...this.parameters.identity }
  }

  @timeout(10000)
  async after() {
    Object.assign(this.parameters.identity, this.saved)
    await super.after()
  }

  private configure(identity: Partial<IConfigParameters['identity']>) {
    Object.assign(this.parameters.identity, {
      chainId: null,
      registryAddress: '',
      rpcUrl: '',
      manifestUrl: '',
      deployBlock: 0,
      ...identity,
    })
  }

  private async readConfig() {
    const res = await identityControllerConfig({
      client: this.apiClient(),
      throwOnError: true,
    })

    expect(res.status).to.equal(200)

    return res.data
  }

  @test()
  async config_isDisabledWhenNothingIsConfigured() {
    this.configure({})

    expect(await this.readConfig()).to.deep.equal({
      enabled: false,
      chainId: null,
      registryAddress: null,
      manifestUrl: null,
      schemaIds: [1],
    })
  }

  @test()
  async config_answersAnonymouslyWithTheConfiguredRegistry() {
    this.configure({
      chainId: 31337,
      registryAddress: REGISTRY_LOWER,
      rpcUrl: RPC_URL,
      manifestUrl: MANIFEST_URL,
    })

    // EIP-55, because that is how a presentation's anchor must spell it.
    expect(await this.readConfig()).to.deep.equal({
      enabled: true,
      chainId: 31337,
      registryAddress: REGISTRY_EIP55,
      manifestUrl: MANIFEST_URL,
      schemaIds: [1],
    })
  }

  @test()
  async config_neverCarriesTheRpcUrl() {
    this.configure({
      chainId: 31337,
      registryAddress: REGISTRY_LOWER,
      rpcUrl: RPC_URL,
    })

    const config = await this.readConfig()

    expect(JSON.stringify(config)).to.not.contain('secret-provider-key')
    expect(config.manifestUrl).to.equal(null)
  }

  @test()
  async config_isDisabledUnlessChainRegistryAndRpcAreAllSet() {
    const complete = {
      chainId: 31337,
      registryAddress: REGISTRY_LOWER,
      rpcUrl: RPC_URL,
    }

    for (const missing of [
      { chainId: null },
      { registryAddress: '' },
      { registryAddress: '0x1234' },
      { rpcUrl: '' },
    ]) {
      this.configure({ ...complete, ...missing, manifestUrl: MANIFEST_URL })

      expect(await this.readConfig(), JSON.stringify(missing)).to.deep.equal({
        enabled: false,
        chainId: null,
        registryAddress: null,
        manifestUrl: null,
        schemaIds: [1],
      })
    }
  }
}

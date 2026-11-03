import { expect } from 'chai'
import axios from 'axios'
import * as web3 from 'web3'
import { suite, test } from '@testdeck/mocha'
import {
  authControllerLoginEth,
  authControllerNonce,
  userControllerConnectWallet,
  userControllerConnectedWalletNonce,
  userControllerDisconnectWallet,
} from '@app/api-client'

import { User } from '@/entity/user'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class ConnectedWalletControllerTest extends BaseControllerTest {
  protected userRepository: UserRepository

  constructor() {
    super()
    this.userRepository = this.container.get('UserRepository')
  }

  private headers(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  private async message(user: User, address: string): Promise<string> {
    const res = await userControllerConnectedWalletNonce({
      client: this.apiClient(),
      headers: this.headers(user),
      body: { address },
      throwOnError: true,
    })

    return res.data as string
  }

  private confirm(user: User, address: string, signature: string) {
    return axios.post(
      `${this.url}/api/user/connected-wallet`,
      { address, signature },
      { headers: this.headers(user), validateStatus: () => true },
    )
  }

  private reload(user: User): Promise<User> {
    return runPromise(this.userRepository.findOneByIdOrFail(user.id))
  }

  @test()
  async connect_storesTheProvenWallet() {
    const user = await this.userFixture.createGoogleUser()
    const wallet = web3.eth.accounts.create()
    const message = await this.message(user, wallet.address)

    await userControllerConnectWallet({
      client: this.apiClient(),
      headers: this.headers(user),
      body: {
        address: wallet.address.toLowerCase(),
        signature: web3.eth.accounts.sign(message, wallet.privateKey).signature,
      },
      throwOnError: true,
    })

    expect((await this.reload(user)).connectedWallet).to.equal(wallet.address)
  }

  @test()
  async connect_refusesAnotherWalletsSignature() {
    const user = await this.userFixture.createGoogleUser()
    const wallet = web3.eth.accounts.create()
    const other = web3.eth.accounts.create()
    const message = await this.message(user, wallet.address)

    const res = await this.confirm(
      user,
      wallet.address,
      web3.eth.accounts.sign(message, other.privateKey).signature,
    )

    expect(res.status).to.equal(401)
    expect((await this.reload(user)).connectedWallet).to.be.null
  }

  @test()
  async connect_refusesASignatureMadeToSignIn() {
    const user = await this.userFixture.createGoogleUser()
    const wallet = web3.eth.accounts.create()
    const nonce = await authControllerNonce({
      client: this.apiClient(),
      body: { address: wallet.address },
      throwOnError: true,
    })

    await this.message(user, wallet.address)
    const res = await this.confirm(
      user,
      wallet.address,
      web3.eth.accounts.sign(nonce.data as string, wallet.privateKey).signature,
    )

    expect(res.status).to.equal(401)
  }

  @test()
  async connect_refusesAMessageIssuedToAnotherAccount() {
    const user = await this.userFixture.createGoogleUser()
    const other = await this.userFixture.createGoogleUser()
    const wallet = web3.eth.accounts.create()
    const message = await this.message(other, wallet.address)

    const res = await this.confirm(
      user,
      wallet.address,
      web3.eth.accounts.sign(message, wallet.privateKey).signature,
    )

    expect(res.status).to.equal(401)
  }

  @test()
  async connect_consumesItsMessage() {
    const user = await this.userFixture.createGoogleUser()
    const wallet = web3.eth.accounts.create()
    const message = await this.message(user, wallet.address)
    const { signature } = web3.eth.accounts.sign(message, wallet.privateKey)

    expect(
      (await this.confirm(user, wallet.address, signature)).status,
    ).to.equal(204)
    expect(
      (await this.confirm(user, wallet.address, signature)).status,
    ).to.equal(401)
  }

  @test()
  async connect_letsSeveralAccountsShareAWallet() {
    const wallet = web3.eth.accounts.create()

    for (const user of [
      await this.userFixture.createGoogleUser(),
      await this.userFixture.createGoogleUser(),
    ]) {
      const message = await this.message(user, wallet.address)
      const res = await this.confirm(
        user,
        wallet.address,
        web3.eth.accounts.sign(message, wallet.privateKey).signature,
      )

      expect(res.status).to.equal(204)
    }
  }

  @test()
  async connect_isForGoogleAccountsOnly() {
    const user = await this.userFixture.createUser()
    const wallet = web3.eth.accounts.create()

    const res = await axios.post(
      `${this.url}/api/user/connected-wallet/nonce`,
      { address: wallet.address },
      { headers: this.headers(user), validateStatus: () => true },
    )

    expect(res.status).to.equal(403)
  }

  @test()
  async connect_needsASignedInUser() {
    const res = await axios.post(
      `${this.url}/api/user/connected-wallet/nonce`,
      { address: web3.eth.accounts.create().address },
      { validateStatus: () => true },
    )

    expect(res.status).to.equal(401)
  }

  /** The two kinds of account are never linked: this makes a separate one. */
  @test()
  async aConnectedWalletSignsNobodyIn() {
    const user = await this.userFixture.createGoogleUser()
    const wallet = web3.eth.accounts.create()
    const message = await this.message(user, wallet.address)

    await this.confirm(
      user,
      wallet.address,
      web3.eth.accounts.sign(message, wallet.privateKey).signature,
    )

    const nonce = await authControllerNonce({
      client: this.apiClient(),
      body: { address: wallet.address },
      throwOnError: true,
    })
    await authControllerLoginEth({
      client: this.apiClient(),
      body: {
        address: wallet.address,
        signature: web3.eth.accounts.sign(
          nonce.data as string,
          wallet.privateKey,
        ).signature,
      },
      throwOnError: true,
    })

    const walletAccount = await runPromise(
      this.userRepository.findByAddressPublicOrFail(wallet.address),
    )
    expect(walletAccount.id).to.not.equal(user.id)
  }

  @test()
  async disconnect_clearsTheWallet() {
    const user = await this.userFixture.createGoogleUser()
    const wallet = web3.eth.accounts.create()
    const message = await this.message(user, wallet.address)

    await this.confirm(
      user,
      wallet.address,
      web3.eth.accounts.sign(message, wallet.privateKey).signature,
    )
    await userControllerDisconnectWallet({
      client: this.apiClient(),
      headers: this.headers(user),
      throwOnError: true,
    })

    expect((await this.reload(user)).connectedWallet).to.be.null
  }
}

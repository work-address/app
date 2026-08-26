import { injectable, inject } from 'inversify'
import * as web3 from 'web3'
import * as crypto from 'crypto'
import bs58 from 'bs58'
import { sign } from 'tweetnacl'

import { faker } from '@faker-js/faker'

import { IConfigParameters } from '@/model/config'

@injectable()
export class Signer {
  @inject('parameters')
  protected parameters: IConfigParameters

  public generateNonce(): string {
    const nonce = `${faker.string.uuid()}-${this.parameters.jwtSecret}`

    return crypto.createHash('md5').update(nonce).digest('hex')
  }

  public verify(nonce: string, signature: string, address: string): boolean {
    const recoveredAddress = web3.eth.accounts.recover(nonce, signature)

    return recoveredAddress.toLowerCase() === address.toLowerCase()
  }

  public verifySolana(
    nonce: string,
    signatureBase64: string,
    address: string,
  ): boolean {
    try {
      const message = Buffer.from(nonce, 'utf8')
      const signature = Buffer.from(signatureBase64, 'base64')
      const publicKey = bs58.decode(address)

      if (publicKey.length !== 32) {
        return false
      }

      return sign.detached.verify(message, signature, publicKey)
    } catch {
      return false
    }
  }
}

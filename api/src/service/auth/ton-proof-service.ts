import { Buffer } from 'buffer'
import { inject, injectable } from 'inversify'
import { sha256 } from '@ton/crypto'
import {
  Address,
  Cell,
  TonClient4,
  contractAddress,
  loadStateInit,
} from '@ton/ton'
import { sign } from 'tweetnacl'

import { tryParsePublicKey } from '@/service/auth/ton-wallets'
import { IAuthTonPayload } from '@/model/auth'
import { IConfigParameters } from '@/model/config'

@injectable()
export class TonProofService {
  @inject('parameters')
  protected parameters: IConfigParameters

  public async checkProof(payload: IAuthTonPayload): Promise<boolean> {
    const tonProofPrefix = 'ton-proof-item-v2/'
    const tonConnectPrefix = 'ton-connect'
    const allowedDomains = this.parameters.tonAllowedDomains
    // Proof freshness window. The nonce is single-use and expires in Redis, so
    // this is defense-in-depth. 60s was too short for real wallet-approval UX.
    const validAuthTime = 15 * 60 // 15 minutes
    const clockSkewTolerance = 5 * 60 // accept small future drift

    try {
      const stateInit = loadStateInit(
        Cell.fromBase64(payload.proof.state_init).beginParse(),
      )

      // 1. First, try to obtain public key via get_public_key get-method on smart contract deployed at Address.
      // 2. If the smart contract is not deployed yet, or the get-method is missing, you need:
      //  2.1. Parse TonAddressItemReply.walletStateInit and get public key from stateInit. You can compare the walletStateInit.code
      //  with the code of standard wallets contracts and parse the data according to the found wallet version.
      const publicKey =
        tryParsePublicKey(stateInit) ??
        (await this.getWalletPublicKey(payload.address))

      if (!publicKey) {
        return false
      }

      // 2.2. Check that TonAddressItemReply.publicKey equals to obtained public key
      const wantedPublicKey = Buffer.from(payload.public_key, 'hex')
      if (!publicKey.equals(wantedPublicKey)) {
        return false
      }

      // 2.3. Check that TonAddressItemReply.walletStateInit.hash() equals to TonAddressItemReply.address. .hash() means BoC hash.
      const wantedAddress = Address.parse(payload.address)
      const address = contractAddress(wantedAddress.workChain, stateInit)
      if (!address.equals(wantedAddress)) {
        return false
      }

      if (
        !allowedDomains.some(
          (allowedDomain) =>
            payload.proof.domain.value === allowedDomain ||
            payload.proof.domain.value.startsWith(`${allowedDomain}:`),
        )
      ) {
        return false
      }

      const now = Math.floor(Date.now() / 1000)
      if (now - validAuthTime > payload.proof.timestamp) {
        return false
      }
      if (payload.proof.timestamp > now + clockSkewTolerance) {
        return false
      }

      const message = {
        workchain: address.workChain,
        address: address.hash,
        domain: {
          lengthBytes: payload.proof.domain.lengthBytes,
          value: payload.proof.domain.value,
        },
        signature: Buffer.from(payload.proof.signature, 'base64'),
        payload: payload.proof.payload,
        stateInit: payload.proof.state_init,
        timestamp: payload.proof.timestamp,
      }

      const wc = Buffer.alloc(4)
      wc.writeUInt32BE(message.workchain, 0)

      const ts = Buffer.alloc(8)
      ts.writeBigUInt64LE(BigInt(message.timestamp), 0)

      const dl = Buffer.alloc(4)
      dl.writeUInt32LE(message.domain.lengthBytes, 0)

      // message = utf8_encode("ton-proof-item-v2/") ++
      //           Address ++
      //           AppDomain ++
      //           Timestamp ++
      //           Payload
      const msg = Buffer.concat([
        Buffer.from(tonProofPrefix),
        wc,
        message.address,
        dl,
        Buffer.from(message.domain.value),
        ts,
        Buffer.from(message.payload),
      ])

      const msgHash = Buffer.from(await sha256(msg))

      // signature = Ed25519Sign(privkey, sha256(0xffff ++ utf8_encode("ton-connect") ++ sha256(message)))
      const fullMsg = Buffer.concat([
        Buffer.from([0xff, 0xff]),
        Buffer.from(tonConnectPrefix),
        msgHash,
      ])

      const result = Buffer.from(await sha256(fullMsg))

      return sign.detached.verify(result, message.signature, publicKey)
    } catch (e) {
      console.log(e)

      return false
    }
  }

  private async getWalletPublicKey(address: string): Promise<Buffer> {
    const client = new TonClient4({
      endpoint: 'https://mainnet-v4.tonhubapi.com',
    })

    const masterAt = await client.getLastBlock()
    const result = await client.runMethod(
      masterAt.last.seqno,
      Address.parse(address),
      'get_public_key',
      [],
    )

    return Buffer.from(
      result.reader.readBigNumber().toString(16).padStart(64, '0'),
      'hex',
    )
  }
}

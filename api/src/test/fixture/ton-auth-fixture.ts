import { Buffer } from 'buffer'
import { sha256 } from '@ton/crypto'
import { beginCell, storeStateInit, WalletContractV4 } from '@ton/ton'
import { sign } from 'tweetnacl'

import { IAuthTonPayload } from '@/model/auth'
import { IConfigParameters } from '@/model/config'

export type TonAuthFixtureResult = {
  payload: IAuthTonPayload
  secretKey: Uint8Array
}

export function getTestTonDomain(parameters: IConfigParameters): string {
  if (parameters.tonAllowedDomains.includes('localhost')) {
    return 'localhost'
  }

  if (parameters.tonAllowedDomains.length > 0) {
    return parameters.tonAllowedDomains[0]
  }

  return 'localhost'
}

export async function buildTonAuthPayload(options: {
  nonce: string
  domain: string
  secretKey?: Uint8Array
  timestamp?: number
}): Promise<TonAuthFixtureResult> {
  const secretKey = options.secretKey ?? sign.keyPair().secretKey
  const keyPair = sign.keyPair.fromSecretKey(secretKey)
  const publicKey = Buffer.from(keyPair.publicKey)

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey,
  })

  const stateInitCell = beginCell().store(storeStateInit(wallet.init)).endCell()
  const state_init = stateInitCell.toBoc().toString('base64')
  const address = `${wallet.address.workChain}:${wallet.address.hash.toString('hex')}`
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000)
  const domain = options.domain
  const payloadNonce = options.nonce

  const wc = Buffer.alloc(4)
  wc.writeUInt32BE(wallet.address.workChain, 0)

  const ts = Buffer.alloc(8)
  ts.writeBigUInt64LE(BigInt(timestamp), 0)

  const dl = Buffer.alloc(4)
  dl.writeUInt32LE(Buffer.byteLength(domain), 0)

  const msg = Buffer.concat([
    Buffer.from('ton-proof-item-v2/'),
    wc,
    wallet.address.hash,
    dl,
    Buffer.from(domain),
    ts,
    Buffer.from(payloadNonce),
  ])

  const msgHash = Buffer.from(await sha256(msg))
  const fullMsg = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from('ton-connect'),
    msgHash,
  ])
  const result = Buffer.from(await sha256(fullMsg))
  const signature = Buffer.from(sign.detached(result, secretKey))

  const payload: IAuthTonPayload = {
    address,
    network: '-239',
    public_key: publicKey.toString('hex'),
    proof: {
      timestamp,
      domain: {
        lengthBytes: Buffer.byteLength(domain),
        value: domain,
      },
      payload: payloadNonce,
      signature: signature.toString('base64'),
      state_init,
    },
  }

  return { payload, secretKey }
}

export async function buildTonAuthPayloadWithInvalidSignature(options: {
  nonce: string
  domain: string
}): Promise<IAuthTonPayload> {
  const { payload } = await buildTonAuthPayload(options)
  const otherKey = sign.keyPair().secretKey

  payload.proof.signature = Buffer.from(
    sign.detached(Buffer.from('invalid-proof'), otherKey),
  ).toString('base64')

  return payload
}

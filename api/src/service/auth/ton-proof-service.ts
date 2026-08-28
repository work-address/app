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
import { Data, Effect, Either } from 'effect'

import { tryParsePublicKey } from '@/service/auth/ton-wallets'
import { IAuthTonPayload } from '@/model/auth'
import { IConfigParameters } from '@/model/config'

export type TonProofRejectionReason =
  | 'public-key-unavailable'
  | 'public-key-mismatch'
  | 'address-mismatch'
  | 'domain-not-allowed'
  | 'proof-expired'
  | 'timestamp-in-future'
  | 'signature-invalid'
  | 'malformed-proof'

// Data.TaggedError is a class factory, not an error construction - `new` here
// would be a type error, so unicorn/throw-new-error is a false positive.
// eslint-disable-next-line unicorn/throw-new-error
export class TonProofRejected extends Data.TaggedError('TonProofRejected')<{
  readonly reason: TonProofRejectionReason
  readonly cause?: unknown
}> {}

@injectable()
export class TonProofService {
  @inject('parameters')
  protected parameters: IConfigParameters

  /**
   * A TON proof can be rejected for six unrelated reasons, and collapsing them
   * into `false` meant a failed wallet login looked identical in the logs to
   * every other failed wallet login. Naming them keeps `checkProof`'s boolean
   * contract for existing callers while making the reason available to anyone
   * who wants it - and stops the old blanket `catch` from quietly swallowing
   * genuine programming errors alongside malformed input.
   */
  public verifyProof(
    payload: IAuthTonPayload,
  ): Effect.Effect<void, TonProofRejected> {
    const tonProofPrefix = 'ton-proof-item-v2/'
    const tonConnectPrefix = 'ton-connect'
    const allowedDomains = this.parameters.tonAllowedDomains
    // Proof freshness window. The nonce is single-use and expires in Redis, so
    // this is defense-in-depth. 60s was too short for real wallet-approval UX.
    const validAuthTime = 15 * 60 // 15 minutes
    const clockSkewTolerance = 5 * 60 // accept small future drift

    const reject = (reason: TonProofRejectionReason) =>
      Effect.fail(new TonProofRejected({ reason }))

    return Effect.gen(this, function* () {
      const stateInit = loadStateInit(
        Cell.fromBase64(payload.proof.state_init).beginParse(),
      )

      // 1. First, try to obtain public key via get_public_key get-method on smart contract deployed at Address.
      // 2. If the smart contract is not deployed yet, or the get-method is missing, you need:
      //  2.1. Parse TonAddressItemReply.walletStateInit and get public key from stateInit. You can compare the walletStateInit.code
      //  with the code of standard wallets contracts and parse the data according to the found wallet version.
      // Falling back to the chain means a network or RPC failure is a distinct
      // reason from a malformed proof, so it gets its own label rather than
      // being folded into the defect handler below.
      const publicKey =
        tryParsePublicKey(stateInit) ??
        (yield* Effect.tryPromise({
          try: () => this.getWalletPublicKey(payload.address),
          catch: (cause) =>
            new TonProofRejected({ reason: 'public-key-unavailable', cause }),
        }))

      if (!publicKey) {
        return yield* reject('public-key-unavailable')
      }

      // 2.2. Check that TonAddressItemReply.publicKey equals to obtained public key
      const wantedPublicKey = Buffer.from(payload.public_key, 'hex')
      if (!publicKey.equals(wantedPublicKey)) {
        return yield* reject('public-key-mismatch')
      }

      // 2.3. Check that TonAddressItemReply.walletStateInit.hash() equals to TonAddressItemReply.address. .hash() means BoC hash.
      const wantedAddress = Address.parse(payload.address)
      const address = contractAddress(wantedAddress.workChain, stateInit)
      if (!address.equals(wantedAddress)) {
        return yield* reject('address-mismatch')
      }

      if (
        allowedDomains.length > 0 &&
        !allowedDomains.some(
          (allowedDomain) =>
            payload.proof.domain.value === allowedDomain ||
            payload.proof.domain.value.startsWith(`${allowedDomain}:`),
        )
      ) {
        return yield* reject('domain-not-allowed')
      }

      const now = Math.floor(Date.now() / 1000)
      if (now - validAuthTime > payload.proof.timestamp) {
        return yield* reject('proof-expired')
      }
      if (payload.proof.timestamp > now + clockSkewTolerance) {
        return yield* reject('timestamp-in-future')
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

      const msgHash = Buffer.from(yield* Effect.promise(() => sha256(msg)))

      // signature = Ed25519Sign(privkey, sha256(0xffff ++ utf8_encode("ton-connect") ++ sha256(message)))
      const fullMsg = Buffer.concat([
        Buffer.from([0xff, 0xff]),
        Buffer.from(tonConnectPrefix),
        msgHash,
      ])

      const result = Buffer.from(yield* Effect.promise(() => sha256(fullMsg)))

      if (!sign.detached.verify(result, message.signature, publicKey)) {
        return yield* reject('signature-invalid')
      }
    }).pipe(
      // Parsing the proof is done with throwing parsers from @ton/ton, so a
      // malformed proof arrives as a defect rather than a failure. Preserving
      // the old catch-all means bad input is still a rejection, not a 500.
      Effect.catchAllDefect((cause) =>
        Effect.fail(new TonProofRejected({ reason: 'malformed-proof', cause })),
      ),
    )
  }

  /** Boolean adapter over {@link verifyProof} for callers that only branch. */
  public async checkProof(payload: IAuthTonPayload): Promise<boolean> {
    const outcome = await Effect.runPromise(
      Effect.either(this.verifyProof(payload)),
    )

    if (Either.isRight(outcome)) {
      return true
    }

    console.log(
      `TonProofService: proof rejected (${outcome.left.reason})`,
      outcome.left.cause ?? '',
    )

    return false
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

import {
  IsEnum,
  IsEthereumAddress,
  IsInt,
  IsObject,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator'

import { EIdentityRelayOperation, EIdentitySaltCustody } from '@/model/identity'

/** The largest uint32: a version or schema id the registry can hold. */
const UINT32_MAX = 4_294_967_295

/**
 * PUT /user/identity: a presentation the holder built and anchored with their
 * own wallet, and, under hosted salt custody, the private export it came
 * from. Only the shape is checked here; the documents themselves are checked
 * by IdentityManager against @work-address/identity and the registry.
 */
export class IdentityPublishDto {
  /** A `work-address/profile-presentation` v1 document, anchored. */
  @IsObject()
  presentation: Record<string, unknown>

  /** `hosted` unless the holder keeps their salts themselves. */
  @IsOptional()
  @IsEnum(EIdentitySaltCustody)
  custody?: EIdentitySaltCustody

  /**
   * The `work-address/profile-export` v1 document behind the presentation:
   * required under hosted custody, refused under holder custody.
   */
  @IsOptional()
  @IsObject()
  export?: Record<string, unknown>
}

/**
 * POST /user/identity/relay: one IdentityRegistry action the holder signed
 * in their own wallet (EIP-712 `Action`), for the relayer to send and pay
 * the gas of. Every field is something the signature covers; the relayer
 * adds nothing to what is sent, and refuses the request unless the
 * signature is the subject's over exactly these values.
 */
export class IdentityRelayDto {
  @IsEnum(EIdentityRelayOperation)
  operation: EIdentityRelayOperation

  /** The signer and the record's key: always the caller's own address. */
  @IsEthereumAddress()
  subject: string

  /** Publication only: the profile commitment, as `publish` takes it. */
  @IsOptional()
  @Matches(/^0x[\dA-Fa-f]{64}$/, { message: 'commitment is 32 bytes of hex' })
  commitment?: string

  /** Publication only. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(UINT32_MAX)
  schemaId?: number

  /** The version the holder expects to be current; 0 withdraws whatever is. */
  @IsInt()
  @Min(0)
  @Max(UINT32_MAX)
  expectedVersion: number

  /** Unix seconds after which the chain refuses the authorization. */
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  deadline: number

  /** The subject's 65-byte signature over the action. */
  @Matches(/^0x[\dA-Fa-f]{130}$/, {
    message: 'signature is a 65-byte hex signature',
  })
  signature: string
}

import { IsEnum, IsObject, IsOptional } from 'class-validator'

import { EIdentitySaltCustody } from '@/model/identity'

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

import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator'

import { IAuthTonPayload } from '@/model/auth'

export class AuthForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  emailOrPhone: string
}

export class AuthEthLoginDto {
  @IsString()
  @IsNotEmpty()
  signature: string

  @IsString()
  @IsNotEmpty()
  address: string
}

export class AuthNonceRequestDto {
  @IsString()
  @IsNotEmpty()
  address: string
}

export class AuthRefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}

export class AuthTonProofDomainDto {
  @IsNumber()
  lengthBytes: number

  @IsString()
  value: string
}

export class AuthTonProofPayloadDto {
  @IsNumber()
  timestamp: number

  @ValidateNested()
  @Type(() => AuthTonProofDomainDto)
  domain: AuthTonProofDomainDto

  @IsString()
  payload: string

  @IsString()
  signature: string

  @IsString()
  state_init: string
}

export class AuthTonLoginDto implements IAuthTonPayload {
  @IsString()
  address: string

  @IsString()
  network: string

  @IsString()
  public_key: string

  @ValidateNested()
  @Type(() => AuthTonProofPayloadDto)
  proof: AuthTonProofPayloadDto
}

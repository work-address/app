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

export class AuthSolanaLoginDto {
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
  @IsNotEmpty()
  value: string
}

export class AuthTonProofPayloadDto {
  @IsNumber()
  timestamp: number

  @ValidateNested()
  @Type(() => AuthTonProofDomainDto)
  domain: AuthTonProofDomainDto

  @IsString()
  @IsNotEmpty()
  payload: string

  @IsString()
  @IsNotEmpty()
  signature: string

  @IsString()
  @IsNotEmpty()
  state_init: string
}

export class AuthTonLoginDto implements IAuthTonPayload {
  @IsString()
  @IsNotEmpty()
  address: string

  @IsString()
  @IsNotEmpty()
  network: string

  @IsString()
  @IsNotEmpty()
  public_key: string

  @ValidateNested()
  @Type(() => AuthTonProofPayloadDto)
  proof: AuthTonProofPayloadDto
}

import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

const EVM_ADDRESS = /^0[Xx][\dA-Fa-f]{40}$/

export class AuthForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  emailOrPhone: string
}

export class AuthEthLoginDto {
  @IsString()
  @IsNotEmpty()
  signature: string

  // Only Google may put an email in `User.address`.
  @IsString()
  @Matches(EVM_ADDRESS)
  address: string
}

export class AuthGoogleLoginDto {
  /** The ID token Google's sign-in button gives the browser. */
  @IsString()
  @IsNotEmpty()
  credential: string
}

export class AuthMethodsDto {
  /** Absent where this deployment doesn't offer Google sign-in. */
  @IsString()
  @IsOptional()
  googleClientId?: string
}

export class AuthNonceRequestDto {
  @IsString()
  @Matches(EVM_ADDRESS)
  address: string
}

export class AuthRefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}

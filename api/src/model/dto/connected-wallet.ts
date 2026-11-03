import { IsNotEmpty, IsString, Matches } from 'class-validator'

const EVM_ADDRESS = /^0[Xx][\dA-Fa-f]{40}$/

export class ConnectedWalletNonceDto {
  @IsString()
  @Matches(EVM_ADDRESS)
  address: string
}

export class ConnectedWalletConfirmDto {
  @IsString()
  @Matches(EVM_ADDRESS)
  address: string

  @IsString()
  @IsNotEmpty()
  signature: string
}

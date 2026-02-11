import {IsString, IsNotEmpty} from 'class-validator';

export class AuthForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  emailOrPhone: string;
}

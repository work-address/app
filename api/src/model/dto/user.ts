import { Type } from 'class-transformer'
import { IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator'

import { EUserRole } from '@/model/user'

import { SearchDto } from './search'

export class UserSearchFilterDto {
  @IsUUID()
  @IsOptional()
  id?: string

  @IsEnum(EUserRole)
  @IsOptional()
  role?: EUserRole
}

export class UserSearchDto extends SearchDto {
  @ValidateNested()
  @Type(() => UserSearchFilterDto)
  filter: UserSearchFilterDto
}

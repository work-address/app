import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
export class RedactionRuleDto {
  @IsIn(['title', 'domain']) field: 'title' | 'domain'
  @IsIn(['contains', 'regex']) match: 'contains' | 'regex'
  @IsString() @MinLength(1) @MaxLength(200) pattern: string
}
export class UserSettingsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RedactionRuleDto)
  personalRedactionRules: RedactionRuleDto[]
}

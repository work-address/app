import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { AGENT_PRODUCTS } from '@/model/agent'

export class AgentDto {
  @IsOptional() @IsUUID() id?: string
  @IsString() @Matches(/^[^<>\u0000-\u001f]{1,60}$/) name: string
  @IsString() @Matches(/^[a-z0-9][a-z0-9-]{0,59}$/) slug: string
  @IsIn(AGENT_PRODUCTS) product: string
  @IsBoolean() isDefault: boolean
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  bindings: string[]
}
export class AgentIdDto {
  @IsUUID() id: string
}
export class AgentRateDto {
  @IsInt() @Min(0) @Max(100000000) rateHourCents: number
}
export class AgentCredentialDto {
  @IsUUID() instanceId: string
  @IsIn(['timer', 'fixed']) mode: 'timer' | 'fixed'
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/^[^<>\u0000-\u001f]*$/)
  label?: string
}
export class AgentSearchDto {
  @IsUUID() projectId: string
  @IsOptional() @IsISO8601() fromAt?: string
  @IsOptional() @IsISO8601() toAt?: string
  @IsOptional() @IsInt() @Min(0) @Max(1000000) offset?: number
}

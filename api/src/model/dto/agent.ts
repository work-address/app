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
  /** Omitted: every project the caller works on. */
  @IsOptional() @IsUUID() projectId?: string
  @IsOptional() @IsISO8601() fromAt?: string
  @IsOptional() @IsISO8601() toAt?: string
  @IsOptional() @IsInt() @Min(0) @Max(1000000) offset?: number
  /** One person's runs, within what the caller may see. */
  @IsOptional() @IsUUID() userId?: string
  /** One of the worker's agents. */
  @IsOptional() @IsUUID() agentId?: string
  /** `fixed` for a server's runs, `timer` for a computer's. */
  @IsOptional() @IsIn(['timer', 'fixed']) mode?: 'timer' | 'fixed'
  @IsOptional() @IsString() @MaxLength(32) status?: string
  /** The runs of one agent session, as its source named it. */
  @IsOptional() @IsString() @MaxLength(256) sessionId?: string
  /** One run. */
  @IsOptional() @Matches(/^[0-9a-f]{64}$/) runKey?: string
}

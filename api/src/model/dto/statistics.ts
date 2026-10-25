import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class StatisticsQueryDto {
  /** Omitted or empty: every project the caller can see. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  projectIds?: string[]
  @IsString() from: string
  @IsString() to: string
  @IsString() timeZone: string
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  userIds?: string[]
  @IsOptional() @IsUUID() invoiceId?: string
  @IsOptional() @IsString() @MaxLength(200) app?: string
  /** How `time/daily` and `agents/daily` cut the period: by day, or by hour. */
  @IsOptional() @IsIn(['day', 'hour']) bucket?: 'day' | 'hour'
}

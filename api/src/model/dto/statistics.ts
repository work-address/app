import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class StatisticsQueryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  projectIds: string[]
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
}

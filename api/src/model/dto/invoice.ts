import { Type } from 'class-transformer'
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator'

import { EInvoiceState } from '@/model/invoice'

import { SearchDto } from './search'

class InvoiceSearchFilterDto {
  @IsUUID()
  @IsOptional()
  projectId?: string
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  fromAt?: Date
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  toAt?: Date
  @IsNumber()
  @IsOptional()
  amountFrom?: number
  @IsNumber()
  @IsOptional()
  amountTo?: number
  @IsEnum(EInvoiceState)
  @IsOptional()
  state?: EInvoiceState
}

export class InvoiceSearchDto extends SearchDto {
  @ValidateNested()
  @Type(() => InvoiceSearchFilterDto)
  filter: InvoiceSearchFilterDto
}

export class InvoiceCreateDto {
  @IsNumber()
  fromUnix: number

  @IsNumber()
  toUnix: number
}

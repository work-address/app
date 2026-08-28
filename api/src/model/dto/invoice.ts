import { Type } from 'class-transformer'
import {
  IsArray,
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
  /** Cents, matching Invoice.amountCents. */
  amountFrom?: number
  @IsNumber()
  @IsOptional()
  /** Cents, matching Invoice.amountCents. */
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

/**
 * The period to bill for.
 *
 * Both bounds are optional, and omitting them means "everything I have not
 * invoiced yet on this project" - the common case, and the only one the UI
 * uses. An explicit range stays available for billing a specific week.
 */
export class InvoiceCreateDto {
  @IsNumber()
  @IsOptional()
  fromUnix?: number

  @IsNumber()
  @IsOptional()
  toUnix?: number

  /**
   * Bill exactly these entries, chosen in the time table. Takes precedence
   * over a range: a selection is explicit about what it covers, where a range
   * only describes a window.
   */
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  timeIds?: string[]
}

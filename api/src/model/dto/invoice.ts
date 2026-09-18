import { Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateIf,
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
 * Omitting both bounds means "everything I have not invoiced yet on this
 * project" - the common case, and the only one the UI uses. An explicit range
 * stays available for billing a specific week.
 *
 * The bounds come as a pair: a request with only one of them is refused
 * rather than read as "everything outstanding", which would bill far more
 * than the caller described.
 */
export class InvoiceCreateDto {
  @ValidateIf(
    (dto: InvoiceCreateDto) =>
      dto.fromUnix !== undefined || dto.toUnix !== undefined,
  )
  @IsNumber()
  fromUnix?: number

  @ValidateIf(
    (dto: InvoiceCreateDto) =>
      dto.fromUnix !== undefined || dto.toUnix !== undefined,
  )
  @IsNumber()
  toUnix?: number

  /**
   * Bill exactly these entries, chosen in the time table. Takes precedence
   * over a range: a selection is explicit about what it covers, where a range
   * only describes a window.
   *
   * An empty list is refused rather than treated as "no selection": a client
   * that sends one meant to bill nothing, and falling through to "everything
   * outstanding" would bill all of it.
   */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  @IsOptional()
  timeIds?: string[]
}

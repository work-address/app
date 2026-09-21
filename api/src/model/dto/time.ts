import { Type } from 'class-transformer'
import {
  Allow,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

/**
 * Highest unix second a window boundary may name. Past it `new Date` starts
 * losing precision, and no work period reaches the year 275760 anyway.
 */
const MAX_UNIX_SECONDS = 8640000000000
import type { OrderByCondition } from 'typeorm'

import { ISearch, SearchDto } from './search'

type SortDirection = Extract<OrderByCondition[string], 'ASC' | 'DESC'>
const SORT_DIRECTIONS: SortDirection[] = ['ASC', 'DESC']

class TimeSearchSortDto {
  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  createdAt?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  updatedAt?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  fromAt?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  toAt?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  keyboardKeys?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  minutesActive?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  mouseKeys?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  mouseDistance?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  note?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  projectName?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  paidStatus?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  screenshot?: SortDirection
}

class TimeSearchFilterDto {
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
  @IsString()
  @IsOptional()
  note?: string
  @IsString()
  @IsOptional()
  screenshot?: string
  @IsNumber()
  @IsOptional()
  keyboardKeysFrom?: number
  @IsNumber()
  @IsOptional()
  keyboardKeysTo?: number
  @IsNumber()
  @IsOptional()
  minutesActiveFrom?: number
  @IsNumber()
  @IsOptional()
  minutesActiveTo?: number
  @IsNumber()
  @IsOptional()
  mouseKeysFrom?: number
  @IsNumber()
  @IsOptional()
  mouseKeysTo?: number
  @IsNumber()
  @IsOptional()
  mouseDistanceFrom?: number
  @IsNumber()
  @IsOptional()
  mouseDistanceTo?: number
  @IsBoolean()
  @IsOptional()
  withScreenshots?: boolean
  @IsBoolean()
  @IsOptional()
  withProcesses?: boolean
}

export class TimeSearchDto extends SearchDto {
  @ValidateNested()
  @Type(() => TimeSearchSortDto)
  sort: TimeSearchSortDto & ISearch['sort']

  @ValidateNested()
  @Type(() => TimeSearchFilterDto)
  filter: TimeSearchFilterDto
}

export class TimeCreateDto {
  @IsNumber()
  fromIndex: number
  @IsNumber()
  toIndex: number
  @IsDateString()
  fromAt: string
  @IsDateString()
  toAt: string

  @IsString()
  projectId: string

  @IsString()
  note: string | null

  @IsNumber()
  minutesActive: number
  @IsNumber()
  keyboardKeys: number
  @IsNumber()
  mouseKeys: number
  @IsNumber()
  mouseDistance: number

  @IsString()
  @IsOptional()
  screenshot?: string

  @IsArray()
  @IsOptional()
  processes?: {
    name: string
    description?: string
    timeMin: number
  }[]
}

export class TimeInsertionErrorDto {
  @IsString()
  name: string

  @IsString()
  message: string

  @IsOptional()
  @Allow()
  errors?: unknown
}

export class TimeIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[]
}

export class TimeInsertionResultDto extends TimeCreateDto {
  @IsUUID()
  @IsOptional()
  id?: string

  @ValidateNested()
  @Type(() => TimeInsertionErrorDto)
  @IsOptional()
  error?: TimeInsertionErrorDto
}

/**
 * The window a totals request is asked for, as the marketplace asks it: one
 * contract week, in unix seconds.
 *
 * Seconds rather than an ISO string because the caller is the marketplace,
 * which already keeps every period boundary that way (escrow's workStart and
 * workEnd), and because a bare date would have to be read in some timezone
 * and the two services do not share one. A week's boundaries are decided by
 * whoever knows the contract - this service is only asked to add up the
 * hours inside them.
 *
 * Both are optional and independent: no window at all is the project's whole
 * history, which is what every caller before this got.
 */
export class TimeTotalsQueryDto {
  /** Inclusive start, in unix seconds; rows starting before it are left out. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_UNIX_SECONDS)
  @IsOptional()
  fromAt?: number

  /** Exclusive end, in unix seconds; rows starting at or after it are left out. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UNIX_SECONDS)
  @IsOptional()
  toAt?: number
}

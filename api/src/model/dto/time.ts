import { Type } from 'class-transformer'
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator'
import type { OrderByCondition } from 'typeorm'

import { ISearch, SearchDto } from './search'

import type { Time } from '@/entity/time'

type SortDirection = Extract<OrderByCondition[string], 'ASC' | 'DESC'>
const SORT_DIRECTIONS: SortDirection[] = ['ASC', 'DESC']

type TimeSource = Time['source']
const TIME_SOURCES: TimeSource[] = ['desktop', 'mobile', 'manual', 'web']

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
  /** Any of these projects; an empty list narrows nothing. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  projectIds?: string[]
  /** Entries by any of these people; an empty list narrows nothing. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  userIds?: string[]
  /** Where the time came from. */
  @IsIn(TIME_SOURCES)
  @IsOptional()
  source?: TimeSource
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
  // App data is validated separately so malformed statistics never discard human time.
  @Allow()
  @IsOptional()
  appsStatus?: unknown
  @Allow()
  @IsOptional()
  appsReason?: unknown
  @Allow()
  @IsOptional()
  appsTruncated?: unknown
  @Allow()
  @IsOptional()
  apps?: unknown
  /**
   * `"mobile"` from the phone app. Anything else, or nothing, is a desktop
   * upload: no other source can be claimed by an upload.
   */
  @Allow()
  @IsOptional()
  source?: unknown

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
  @IsBoolean()
  @IsOptional()
  appsAccepted?: boolean

  @IsUUID()
  @IsOptional()
  id?: string

  @ValidateNested()
  @Type(() => TimeInsertionErrorDto)
  @IsOptional()
  error?: TimeInsertionErrorDto
}

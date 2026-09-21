import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
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

import { EProjectState } from '@/model/project'

import { ISearch, SearchDto, SORT_DIRECTIONS, SortDirection } from './search'

class ProjectSearchSortDto {
  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  createdAt?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  updatedAt?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  title?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  state?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  rateHour?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  trackScreenshots?: SortDirection

  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  trackProcesses?: SortDirection
}

class ProjectSearchFilterDto {
  @IsUUID()
  @IsOptional()
  userId?: string
  @IsUUID()
  @IsOptional()
  projectId?: string
  @IsEnum(EProjectState)
  @IsOptional()
  state?: EProjectState
  @IsString()
  @IsOptional()
  title?: string
  @IsString()
  @IsOptional()
  text?: string
  @IsNumber()
  @IsOptional()
  rateHourFrom?: number
  @IsNumber()
  @IsOptional()
  rateHourTo?: number
  @IsBoolean()
  @IsOptional()
  trackScreenshots?: boolean
  @IsBoolean()
  @IsOptional()
  trackProcesses?: boolean
  @IsBoolean()
  @IsOptional()
  withScreenshots?: boolean
  @IsBoolean()
  @IsOptional()
  withProcesses?: boolean
}

export class ProjectSearchDto extends SearchDto {
  @ValidateNested()
  @Type(() => ProjectSearchSortDto)
  sort: ProjectSearchSortDto & ISearch['sort']

  @ValidateNested()
  @Type(() => ProjectSearchFilterDto)
  filter: ProjectSearchFilterDto
}

export type ProjectAccessAddresses = {
  workerAddresses: string[]
  viewerAddresses: string[]
}

/**
 * A new version of the project's invoicing cadence.
 *
 * Every field is required: a cadence half-stated is a cadence nobody can
 * predict, and the one thing this rule has to be is predictable. The shape
 * alone is checked here - that the zone exists, and that the time of day
 * parses, is `InvoiceCadence.problems`, so the reasons come back in one
 * answer rather than as whichever decorator fired first.
 */
export class ProjectCadenceDto {
  /** 0 is Sunday and 6 is Saturday, as `moment().day()` numbers them. */
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number

  /** An IANA zone name, e.g. `Europe/Berlin`. */
  @IsString()
  timezone: string

  /** The local wall-clock cutoff, `HH:mm`. */
  @IsString()
  cutoffLocal: string

  /**
   * When this version starts governing, in unix milliseconds. Omitted means
   * "from now", which is what an owner editing the rule today means.
   */
  @IsNumber()
  @IsOptional()
  effectiveFromUnix?: number

  /**
   * Hours between a period's cutoff and its invoice. Omitted takes
   * `InvoiceCadence.DEFAULT_FINALIZATION_DELAY_HOURS`.
   */
  @IsInt()
  @Min(0)
  @IsOptional()
  finalizationDelayHours?: number
}

/**
 * One worker's answer to automatic issuance. A bare boolean rather than a
 * bodyless route per answer, so withdrawing consent is the same call as
 * giving it and cannot be reached by accident.
 */
export class ProjectCadenceConsentDto {
  @IsBoolean()
  consented: boolean
}

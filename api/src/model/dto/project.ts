import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

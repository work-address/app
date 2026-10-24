import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

import { EUserRole } from '@/model/user'

export const ADMIN_USER_SORT_FIELDS = ['createdAt', 'lastSeenAt'] as const
export type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number]
export const ADMIN_PAGE_LIMIT_MAX = 100
export const ADMIN_STATS_DAYS_MAX = 365

export class AdminUserSearchFilterDto {
  /** Case-insensitive substring of name, email, phone or wallet address. */
  @IsString()
  @MaxLength(200)
  @IsOptional()
  query?: string

  @IsBoolean()
  @IsOptional()
  premium?: boolean

  /** Resolves a known set of accounts, e.g. the owners on one page of jobs. */
  @IsArray()
  @ArrayMaxSize(ADMIN_PAGE_LIMIT_MAX)
  @IsUUID('all', { each: true })
  @IsOptional()
  ids?: string[]
}

export class AdminUserSortDto {
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  createdAt?: 'ASC' | 'DESC'

  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  lastSeenAt?: 'ASC' | 'DESC'
}

export class AdminUserSearchDto {
  @IsInt()
  @Min(0)
  page: number

  @IsInt()
  @Min(1)
  @Max(ADMIN_PAGE_LIMIT_MAX)
  @IsOptional()
  limit?: number

  @ValidateNested()
  @Type(() => AdminUserSearchFilterDto)
  @IsOptional()
  filter?: AdminUserSearchFilterDto

  @ValidateNested()
  @Type(() => AdminUserSortDto)
  @IsOptional()
  sort?: AdminUserSortDto
}

/** One account as the admin dashboard sees it: contact details included. */
export class AdminUserDto {
  @IsUUID() id: string
  @IsString() address: string
  @IsString() @IsOptional() name: string | null
  @IsString() @IsOptional() email: string | null
  @IsString() @IsOptional() phone: string | null
  @IsString() @IsOptional() title: string | null
  @IsString() @IsOptional() company: string | null
  @IsString() @IsOptional() city: string | null
  @IsString() @IsOptional() country: string | null
  @IsArray() @IsEnum(EUserRole, { each: true }) roles: EUserRole[]
  @IsBoolean() premium: boolean
  @IsDate() createdAt: Date
  @IsDate() @IsOptional() lastSeenAt: Date | null
}

export class AdminDailyCountDto {
  /** UTC calendar day, `YYYY-MM-DD`. */
  @IsString() date: string
  @IsInt() count: number
}

export class AdminUserStatsDto {
  @IsInt() total: number
  @IsInt() premium: number
  @IsInt() active1d: number
  @IsInt() active7d: number
  @IsInt() active30d: number
  /** New accounts in the window. */
  @IsInt() signupsInWindow: number

  /** One entry per day in the window, oldest first, zero-filled. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminDailyCountDto)
  signups: AdminDailyCountDto[]
}

export class AdminUserStatsQueryDto {
  @IsNumber()
  @Min(1)
  @Max(ADMIN_STATS_DAYS_MAX)
  @Type(() => Number)
  @IsOptional()
  days?: number
}

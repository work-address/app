import { IsNumber, IsObject, IsOptional, IsNotEmpty } from 'class-validator'
import type { OrderByCondition } from 'typeorm'

export type SortDirection = Extract<OrderByCondition[string], 'ASC' | 'DESC'>
export const SORT_DIRECTIONS: SortDirection[] = ['ASC', 'DESC']

export interface ISearch {
  sort: OrderByCondition
  page: number
  filter: unknown
  limit?: number
}

export class SearchDto implements ISearch {
  @IsNumber()
  @IsNotEmpty()
  page: number

  @IsObject()
  filter: unknown

  @IsObject()
  sort: OrderByCondition

  @IsNumber()
  @IsOptional()
  limit?: number
}

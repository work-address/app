import {OrderByCondition} from 'typeorm';

export interface ISearch {
  sort: OrderByCondition;
  page: number;
  filter: any;
  query?: string;
  limit?: number;
}

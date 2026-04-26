import {OrderByCondition} from 'typeorm';

import {EProjectState} from './project';
import {EUserRole} from './user';

export interface ISearch {
  sort: OrderByCondition;
  page: number;
  filter: any;
  query?: string;
  limit?: number;
}

export interface ISearchProject extends ISearch {
  filter: {
    userId?: string;
    projectId?: string;
    state?: EProjectState;
  };
}

export interface ISearchTime extends ISearch {
  filter: {
    projectId?: string;
  };
}

export interface ISearchUser extends ISearch {
  filter: {
    id?: string;
    role?: EUserRole;
  };
}

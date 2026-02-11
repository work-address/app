import {ISearch} from './ISearch';

export interface ISearchTime extends ISearch {
  filter: {
    activityId?: string;
  };
}

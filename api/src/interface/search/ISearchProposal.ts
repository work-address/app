import {ISearch} from './ISearch';

export interface ISearchProposal extends ISearch {
  filter: {
    activityId?: string;
  };
}

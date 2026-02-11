import {EActivityState} from '../EActivityState';
import {EActivityType} from '../EActivityType';
import {ISearch} from './ISearch';

export interface ISearchActivity extends ISearch {
  filter: {
    userId?: string;
    activityId?: string;
    state?: EActivityState;
    type?: EActivityType;
    keywords?: string[];
  };
}

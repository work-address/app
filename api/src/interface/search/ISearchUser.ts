import {EUserRole} from '../EUserRole';
import {ISearch} from './ISearch';

export interface ISearchUser extends ISearch {
  filter: {
    id?: string;
    role?: EUserRole;
  };
}

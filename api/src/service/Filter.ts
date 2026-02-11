import {injectable} from 'inversify';
import * as _ from 'lodash';
import {OrderByCondition} from 'typeorm';

import {ISearch} from '../interface/search/ISearch';

@injectable()
export class Filter {
  private defaultLimit = 20;

  buildOrderByCondition(domain: string, search: ISearch): OrderByCondition {
    const sort: OrderByCondition = {};

    if (Object.keys(search.sort).length > 0) {
      sort[`${domain}.${_.keys(search.sort)[0]}`] = _.values(search.sort)[0];
    }

    return sort;
  }

  buildLimit(search: ISearch): number {
    if (search.limit) {
      return search.limit;
    }

    return this.defaultLimit;
  }
}

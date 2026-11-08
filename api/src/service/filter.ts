import { injectable } from 'inversify'
import { BadRequestError } from 'routing-controllers'
import { OrderByCondition } from 'typeorm'

import { ISearch } from '@/model/dto/search'

@injectable()
export class Filter {
  private defaultLimit = 20

  /**
   * The order a search asked for, out of `columns`: every order its list can
   * ask for, by the name it asks with. A list rather than `${table}.${key}`,
   * because the key comes from the request and TypeORM writes it into the SQL
   * as given, and because any column reachable here can be read back through
   * the order of the rows, even when the rows themselves leave it out.
   *
   * The first key orders. The rest are refused alike, so a bad key is never
   * silently ignored.
   */
  buildOrderByCondition(
    columns: ReadonlyMap<string, string>,
    search: ISearch,
    rows: string,
  ): OrderByCondition {
    const orders = Object.entries(search.sort).map(([key, direction]) => {
      const column = columns.get(key)

      if (!column || (direction !== 'ASC' && direction !== 'DESC')) {
        throw new BadRequestError(`Cannot sort ${rows} by ${key}`)
      }

      return { [column]: direction }
    })

    return orders[0] ?? {}
  }

  buildLimit(search: ISearch): number {
    if (search.limit) {
      return search.limit
    }

    return this.defaultLimit
  }
}

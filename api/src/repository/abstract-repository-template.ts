import { Effect } from 'effect'
import {
  DeepPartial,
  EntityTarget,
  FindOptionsWhere,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  SaveOptions,
  SelectQueryBuilder,
  UpdateResult,
} from 'typeorm'

import { Repository } from 'typeorm/repository/Repository'
import { getDataSource } from '@/connector/data-source'
import { ISearch } from '@/model/dto/search'
import { Filter } from '@/service/filter'
import ConstraintsValidationException from '@/exception/constraints-validation-exception'
import { fromPromise } from '@/service/effect-bridge'
import { validate } from 'class-validator'

export type TRelations = Record<string, unknown>
export type TFindOptions = TRelations
export type TSelectOptions = TRelations

/**
 * Every repository call can fail the same way - a dropped connection, a
 * constraint violation, a validation error - and none of those are worth
 * enumerating per method. The error channel stays `unknown` so the original
 * exception (which ErrorHandler reads `httpCode` off) travels untouched; what
 * the type buys here is that a query is a description until someone runs it,
 * so services can compose them instead of firing each one on creation.
 */
export type RepoEffect<A> = Effect.Effect<A, unknown>

export abstract class AbstractRepositoryTemplate<T extends ObjectLiteral> {
  protected filter: Filter
  protected target: EntityTarget<T> & { name: string }

  public validateAndSave(entity: T): RepoEffect<T> {
    return Effect.gen(this, function* () {
      const errors = yield* fromPromise(() => validate(entity))

      if (errors.length) {
        return yield* Effect.fail(new ConstraintsValidationException(errors))
      }

      return yield* this.saveSingle(entity)
    })
  }

  public findBy(options: FindManyOptions<T>): RepoEffect<T[]> {
    return fromPromise(() => this.getRepo().find(options))
  }

  public findOneBy(options: FindOneOptions<T>): RepoEffect<T | undefined> {
    return fromPromise(
      async () => (await this.getRepo().findOne(options)) ?? undefined,
    )
  }

  public findOneByOrFail(options: FindOneOptions<T>): RepoEffect<T> {
    return fromPromise(() => this.getRepo().findOneOrFail(options))
  }

  public findOneByIdOrFail(
    id: string | string,
    options?: FindOneOptions<T>,
  ): RepoEffect<T> {
    return fromPromise(() =>
      this.getRepo().findOneOrFail({
        ...options,
        where: { id } as unknown as FindOptionsWhere<T>,
      }),
    )
  }

  public saveSingle(entity: T, options?: SaveOptions): RepoEffect<T> {
    return fromPromise(() =>
      this.getRepo().save(entity as DeepPartial<T>, options),
    )
  }

  public saveMany(entities: T[], options?: SaveOptions): RepoEffect<T[]> {
    return fromPromise(() =>
      this.getRepo().save(entities as DeepPartial<T>[], options),
    )
  }

  public remove(entity: T): RepoEffect<T> {
    return fromPromise(() => this.getRepo().remove(entity))
  }

  public removeMany(entities: T[]): RepoEffect<T[]> {
    return fromPromise(() => this.getRepo().remove(entities))
  }

  public softDelete(conditions: FindOptionsWhere<T>): RepoEffect<UpdateResult> {
    return fromPromise(() => this.getRepo().softDelete(conditions))
  }

  public getRepo(): Repository<T> {
    return getDataSource().getRepository(this.target)
  }

  public findOneByQueryBuilder<Entity extends ObjectLiteral>(
    findOptions: TFindOptions,
    selectOptions: null | TSelectOptions = null,
    relations: null | TRelations = null,
    searchOptions: ISearch | null = null,
  ) {
    const mainAliasName: string = this.target.name.toLowerCase()
    const query = this.getRepo()
      .createQueryBuilder(mainAliasName)
      .select()
      .orderBy(`${mainAliasName}.id`, 'ASC')

    if (relations) {
      AbstractRepositoryTemplate.buildRelations(relations, mainAliasName, query)
    }

    if (selectOptions) {
      const arrayOfSelectOptions =
        AbstractRepositoryTemplate.buildSelectOptions(
          selectOptions,
          relations,
          mainAliasName,
        )

      query.select(arrayOfSelectOptions)
    }

    query.where((qb: SelectQueryBuilder<Entity>) => {
      AbstractRepositoryTemplate.buildFindOptions(
        findOptions,
        mainAliasName,
        qb,
      )
    })

    if (searchOptions) {
      if (searchOptions.sort) {
        const sort = this.filter.buildOrderByCondition(
          mainAliasName,
          searchOptions,
        )
        query.orderBy(sort)
      }
    }

    return fromPromise(() => query.getOne())
  }

  static buildRelations<E extends ObjectLiteral>(
    relations: TRelations,
    parentKey: string,
    query: SelectQueryBuilder<E>,
  ) {
    Object.keys(relations).forEach((key: string) => {
      query.leftJoinAndSelect(`${parentKey}.${key}`, `${parentKey}_${key}`)

      if (
        typeof relations[key] === 'object' &&
        relations[key] !== null &&
        !Array.isArray(relations[key])
      ) {
        AbstractRepositoryTemplate.buildRelations(
          relations[key] as TRelations,
          `${parentKey}_${key}`,
          query,
        )
      }
    })
  }

  static buildFindOptions<E extends ObjectLiteral>(
    findOptions: TFindOptions,
    parentKey: string,
    query: SelectQueryBuilder<E>,
  ) {
    Object.keys(findOptions).forEach((key: string) => {
      if (
        typeof findOptions[key] === 'object' &&
        findOptions[key] !== null &&
        !Array.isArray(findOptions[key])
      ) {
        return AbstractRepositoryTemplate.buildFindOptions(
          findOptions[key] as TFindOptions,
          `${parentKey}_${key}`,
          query,
        )
      }

      if (Array.isArray(findOptions[key])) {
        const values = findOptions[key] as number[] | string[]
        query.andWhere(`${parentKey}.${key} IN (:...${key})`, { [key]: values })
      } else {
        query.andWhere(`${parentKey}.${key} = :${key}`, {
          [key]: findOptions[key],
        })
      }
    })
  }

  static buildSelectOptions(
    selectOptions: TSelectOptions,
    relations: TRelations | null,
    parentKey: string,
    result: string[] = [],
  ) {
    const selectOptionsKeys = Object.keys(selectOptions)

    // first level
    if (!result.length) {
      const doesExistSthExceptRelations = selectOptionsKeys.some(
        (key) => typeof selectOptions[key] !== 'object',
      )

      if (!doesExistSthExceptRelations) {
        const metadata = AbstractRepositoryTemplate.getMetadata(parentKey)
        const targetFields: string[] = metadata.ownColumns.map(
          (column) => `${parentKey}_${column.propertyName}`,
        )
        selectOptionsKeys.push(...targetFields)
      }
    }

    result.push(`${parentKey}.id`)

    if (relations) {
      const relationsKeys = Object.keys(relations)

      relationsKeys.forEach((key: string) => {
        if (!selectOptionsKeys.includes(key)) {
          const metadata = AbstractRepositoryTemplate.getMetadata(key)
          const targetFields: string[] = metadata.ownColumns.map(
            (column) => column.propertyName,
          )

          targetFields.forEach((fieldName: string) => {
            result.push(`${parentKey}_${key}.${fieldName}`)
          })
        }
      })
    }

    selectOptionsKeys.forEach((key: string) => {
      if (typeof selectOptions[key] === 'object') {
        const nestedRelations =
          relations &&
          typeof relations[key] === 'object' &&
          relations[key] !== null &&
          !Array.isArray(relations[key])
            ? (relations[key] as TRelations)
            : null

        AbstractRepositoryTemplate.buildSelectOptions(
          selectOptions[key] as TSelectOptions,
          nestedRelations,
          `${parentKey}_${key}`,
          result,
        )
      } else {
        result.push(`${parentKey}.${key}`)
      }
    })

    return result
  }

  static getMetadata(propertyName: string) {
    let metadata

    const validPropertyName = propertyName.toLowerCase()

    try {
      metadata = getDataSource().getMetadata(validPropertyName)
    } catch {
      // remove 's' symbol from the end
      metadata = getDataSource().getMetadata(validPropertyName.slice(0, -1))
    }

    return metadata
  }
}

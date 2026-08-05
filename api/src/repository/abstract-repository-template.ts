import {
  DeepPartial,
  EntityTarget,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  getRepository,
  SaveOptions,
  SelectQueryBuilder,
  getConnection,
} from 'typeorm'

import { Repository } from 'typeorm/repository/Repository'
import { ISearch } from '@/model/dto/search'
import { Filter } from '@/service/filter'
import ConstraintsValidationException from '@/exception/constraints-validation-exception'
import { validate } from 'class-validator'

export type TRelations = Record<string, unknown>
export type TFindOptions = TRelations
export type TSelectOptions = TRelations

export abstract class AbstractRepositoryTemplate<T extends ObjectLiteral> {
  protected filter: Filter
  protected target: EntityTarget<T> & { name: string }

  async validateAndSave(entity: T): Promise<T> {
    const errors = await validate(entity)

    if (errors.length) {
      throw new ConstraintsValidationException(errors)
    }

    return this.saveSingle(entity)
  }

  public async findBy(options: FindManyOptions<T>): Promise<T[]> {
    return this.getRepo().find(options)
  }

  public async findOneBy(options: FindOneOptions<T>): Promise<T | undefined> {
    return this.getRepo().findOne(options)
  }

  public async findOneByOrFail(options: FindOneOptions<T>): Promise<T> {
    return this.getRepo().findOneOrFail(options)
  }

  public findOneByIdOrFail(
    id: string | string,
    options?: FindOneOptions<T>,
  ): Promise<T> {
    return this.getRepo().findOneOrFail(id, options)
  }

  public saveSingle(entity: T, options?: SaveOptions): Promise<T> {
    return this.getRepo().save(entity as DeepPartial<T>, options)
  }

  public saveMany(entities: T[], options?: SaveOptions): Promise<T[]> {
    return this.getRepo().save(entities as DeepPartial<T>[], options)
  }

  public async remove(entity: T): Promise<T> {
    return await this.getRepo().remove(entity)
  }

  public async removeMany(entities: T[]): Promise<T[]> {
    return await this.getRepo().remove(entities)
  }

  public async softDelete(conditions: FindConditions<T>) {
    return await this.getRepo().softDelete(conditions)
  }

  public getRepo(): Repository<T> {
    return getRepository(this.target)
  }

  public findOneByQueryBuilder<Entity>(
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

    return query.getOne()
  }

  static buildRelations<E>(
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

  static buildFindOptions<E>(
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
      metadata = getConnection().getMetadata(validPropertyName)
    } catch {
      // remove 's' symbol from the end
      metadata = getConnection().getMetadata(validPropertyName.slice(0, -1))
    }

    return metadata
  }
}

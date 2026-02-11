import {
  DeepPartial,
  DeleteResult,
  EntityTarget,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  getRepository,
  SaveOptions,
  SelectQueryBuilder,
  getConnection,
} from 'typeorm';

import {Repository} from 'typeorm/repository/Repository';
import {ISearch} from '../interface/search/ISearch';
import {Filter} from '../service/Filter';
import ConstraintsValidationException from '../exception/ConstraintsValidationException';
import {validate} from 'class-validator';

export interface ObjectLiteral {
  [key: string]: any;
}

export type TRelations = {[key: string]: boolean | any};
export type TFindOptions = TRelations;
export type TSelectOptions = TRelations;

export abstract class AbstractRepositoryTemplate<T extends ObjectLiteral> {
  protected filter: Filter;
  protected target: EntityTarget<T> & {name: string};

  async validateAndSave(activity: T): Promise<T> {
    const errors = await validate(activity);

    if (errors.length) {
      throw new ConstraintsValidationException(errors);
    }

    return this.saveSingle(activity);
  }

  public async findBy(options: FindManyOptions<T>): Promise<T[]> {
    return this.getRepo().find(options);
  }

  public async findOneBy(options: FindOneOptions<T>): Promise<T | undefined> {
    return this.getRepo().findOne(options);
  }

  public async findOneByOrFail(options: FindOneOptions<T>): Promise<T> {
    return this.getRepo().findOneOrFail(options);
  }

  public findOneByIdOrFail(id: string | string, options?: FindOneOptions<T>): Promise<T> {
    return this.getRepo().findOneOrFail(id, options);
  }

  public saveSingle<T>(entity: T, options?: SaveOptions): Promise<T> {
    return this.getRepo().save(entity as any, options);
  }

  public saveMany<T>(entities: T[], options?: SaveOptions): Promise<T[]> {
    return this.getRepo().save(entities as any, options);
  }

  public createEntity(entityLike: DeepPartial<T>): T {
    return this.getRepo().create(entityLike);
  }

  public async remove(entity: T): Promise<T> {
    return await this.getRepo().remove(entity);
  }

  public removeById(id: string): Promise<DeleteResult> {
    return this.getRepo().delete(id);
  }

  public async delete(conditions: FindConditions<T>) {
    return await this.getRepo().delete(conditions);
  }

  public async softDelete(conditions: FindConditions<T>) {
    return await this.getRepo().softDelete(conditions);
  }

  public getRepo(): Repository<T> {
    return getRepository(this.target);
  }

  public findOneByQueryBuilder<Entity>(
    findOptions: TFindOptions,
    selectOptions: null | TSelectOptions = null,
    relations: null | TRelations = null,
    searchOptions: ISearch | any = null
  ) {
    const mainAliasName: string = this.target.name.toLowerCase();
    const query = this.getRepo()
      .createQueryBuilder(mainAliasName)
      .select()
      .orderBy(`${mainAliasName}.id`, 'ASC');

    if (relations) {
      AbstractRepositoryTemplate.buildRelations(relations, mainAliasName, query);
    }

    if (selectOptions) {
      const arrayOfSelectOptions = AbstractRepositoryTemplate.buildSelectOptions(
        selectOptions,
        relations,
        mainAliasName
      );

      query.select(arrayOfSelectOptions);
    }

    query.where((qb: SelectQueryBuilder<Entity>) => {
      AbstractRepositoryTemplate.buildFindOptions(findOptions, mainAliasName, qb);
    });

    if (searchOptions) {
      if (searchOptions.sort) {
        const sort = this.filter.buildOrderByCondition(mainAliasName, searchOptions);
        query.orderBy(sort);
      }
    }

    return query.getOne();
  }

  static buildRelations<E>(relations: TRelations, parentKey: string, query: SelectQueryBuilder<E>) {
    Object.keys(relations).forEach((key: string) => {
      query.leftJoinAndSelect(`${parentKey}.${key}`, `${parentKey}_${key}`);

      if (typeof relations[key] === 'object') {
        AbstractRepositoryTemplate.buildRelations(relations[key], `${parentKey}_${key}`, query);
      }
    });
  }

  static buildFindOptions<E>(
    findOptions: TFindOptions,
    parentKey: string,
    query: SelectQueryBuilder<E>
  ) {
    Object.keys(findOptions).forEach((key: string) => {
      if (typeof findOptions[key] === 'object' && !Array.isArray(findOptions[key])) {
        return AbstractRepositoryTemplate.buildFindOptions(
          findOptions[key],
          `${parentKey}_${key}`,
          query
        );
      }

      if (key === 'query') {
        const value: string = findOptions[key];
        query.andWhere(`${parentKey}.${key} ILIKE :${key}`, {[key]: `%${value}%`});
      } else if (Array.isArray(findOptions[key])) {
        const values: number[] | string[] = findOptions[key];
        query.andWhere(`${parentKey}.${key} IN (:...${key})`, {[key]: values});
      } else {
        query.andWhere(`${parentKey}.${key} = :${key}`, {[key]: findOptions[key]});
      }
    });
  }

  static buildSelectOptions(
    selectOptions: TSelectOptions,
    relations: TRelations | null,
    parentKey: string,
    result: string[] = []
  ) {
    const selectOptionsKeys = Object.keys(selectOptions);

    // first level
    if (!result.length) {
      const doesExistSthExceptRelations = selectOptionsKeys.some(
        key => typeof selectOptions[key] !== 'object'
      );

      if (!doesExistSthExceptRelations) {
        const metadata = AbstractRepositoryTemplate.getMetadata(parentKey);
        const targetFields: string[] = metadata.ownColumns.map(
          column => `${parentKey}_${column.propertyName}`
        );
        selectOptionsKeys.push(...targetFields);
      }
    }

    result.push(`${parentKey}.id`);

    if (relations) {
      const relationsKeys = Object.keys(relations);

      relationsKeys.forEach((key: string) => {
        if (!selectOptionsKeys.includes(key)) {
          const metadata = AbstractRepositoryTemplate.getMetadata(key);
          const targetFields: string[] = metadata.ownColumns.map(column => column.propertyName);

          targetFields.forEach((fieldName: string) => {
            result.push(`${parentKey}_${key}.${fieldName}`);
          });
        }
      });
    }

    selectOptionsKeys.forEach((key: string) => {
      if (typeof selectOptions[key] === 'object') {
        AbstractRepositoryTemplate.buildSelectOptions(
          selectOptions[key],
          relations ? relations[key] : null,
          `${parentKey}_${key}`,
          result
        );
      } else {
        result.push(`${parentKey}.${key}`);
      }
    });

    return result;
  }

  static getMetadata(propertyName: string) {
    let metadata;

    const validPropertyName = propertyName.toLowerCase();

    try {
      metadata = getConnection().getMetadata(validPropertyName);
    } catch (e) {
      // remove 's' symbol from the end
      metadata = getConnection().getMetadata(validPropertyName.slice(0, -1));
    }

    return metadata;
  }
}

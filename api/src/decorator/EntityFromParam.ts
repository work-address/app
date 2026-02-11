import {getMetadataArgsStorage, NotFoundError} from 'routing-controllers';
import {getConnectionManager} from 'typeorm';

import {
  AbstractRepositoryTemplate,
  TRelations,
  TSelectOptions,
} from '../repository/AbstractRepositoryTemplate';

export function EntityFromParam(
  paramName: string,
  selectOptions: null | TSelectOptions = null,
  relations: null | TRelations = null
) {
  // eslint-disable-next-line
  return function (object: Object, methodName: string, index: number) {
    const reflectedType = (Reflect as any).getMetadata('design:paramtypes', object, methodName)[
      index
    ];
    if (!reflectedType) throw new Error('Cannot guess type if the parameter');

    getMetadataArgsStorage().params.push({
      object: object,
      method: methodName,
      index: index,
      name: paramName,
      type: 'param',
      parse: false,
      required: false,
      transform: (_actionProperties, value) =>
        entityTransform(value, reflectedType, selectOptions, relations),
    });
  };
}

async function entityTransform(
  value: any,
  target: any,
  selectOptions: null | TSelectOptions = null,
  relations: null | TRelations = null
) {
  if (value === null || value === undefined) return Promise.resolve(value);

  const connection = getConnectionManager().get(undefined);
  const repository = connection.getRepository(target);

  let res;

  if (selectOptions || relations) {
    res = await AbstractRepositoryTemplate.prototype.findOneByQueryBuilder.bind({
      target,
      getRepo: () => repository,
    })({id: value}, selectOptions, relations);
  } else {
    res = await repository.findOne(value);
  }

  if (!res) {
    const entityName: string = target.name || 'Entity';
    const messageOnNotFound = `${entityName} does not exist`;
    throw new NotFoundError(messageOnNotFound);
  }

  return res;
}

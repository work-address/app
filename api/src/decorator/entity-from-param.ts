import { getMetadataArgsStorage, NotFoundError } from 'routing-controllers'

import { WalletAddress } from '@/service/wallet-address'
import { EntityTarget, FindOptionsWhere, Raw } from 'typeorm'
import 'reflect-metadata'

import { getDataSource } from '@/connector/data-source'
import { runPromise } from '@/service/effect-bridge'
import {
  AbstractRepositoryTemplate,
  TRelations,
  TSelectOptions,
} from '@/repository/abstract-repository-template'

export interface EntityFromParamMetadataItem {
  entityName: string
}

export interface EntityFromParamArgs {
  paramName: string
  selectOptions?: null | TSelectOptions
  relations?: null | TRelations
  lookupField?: string
}

const ENTITY_FROM_PARAM_OPENAPI_METADATA_KEY =
  'openapi:entity-from-param:not-found'

export function getEntityFromParamMetadata(
  object: Object,
  methodName: string,
): EntityFromParamMetadataItem[] {
  return (
    Reflect.getOwnMetadata(
      ENTITY_FROM_PARAM_OPENAPI_METADATA_KEY,
      object,
      methodName,
    ) ?? []
  )
}

export function EntityFromParam({
  paramName,
  selectOptions = null,
  relations = null,
  lookupField = 'id',
}: EntityFromParamArgs) {
  return function (object: Object, methodName: string, index: number) {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      object,
      methodName,
    ) as unknown
    if (!Array.isArray(paramTypes)) {
      throw new Error('Cannot guess type if the parameter')
    }
    const reflectedType = paramTypes[index] as
      | (new (...args: unknown[]) => object)
      | undefined
    if (!reflectedType) throw new Error('Cannot guess type if the parameter')

    const existingMeta = getEntityFromParamMetadata(object, methodName)
    Reflect.defineMetadata(
      ENTITY_FROM_PARAM_OPENAPI_METADATA_KEY,
      [...existingMeta, { entityName: reflectedType.name || 'Entity' }],
      object,
      methodName,
    )

    getMetadataArgsStorage().params.push({
      object: object,
      method: methodName,
      index: index,
      name: paramName,
      type: 'param',
      parse: false,
      required: false,
      transform: (_actionProperties, value) =>
        entityTransform(
          value,
          reflectedType,
          selectOptions,
          relations,
          lookupField,
        ),
    })
  }
}

async function entityTransform(
  value: unknown,
  target: EntityTarget<object> & { name?: string },
  selectOptions: null | TSelectOptions = null,
  relations: null | TRelations = null,
  lookupField: string = 'id',
) {
  if (value === null || value === undefined) return Promise.resolve(value)

  // A wallet address in a URL is whatever the user copied out of their wallet,
  // which for TON is the friendly form while the column holds the raw one. So
  // TON is collapsed to raw, and the comparison is case-insensitive because an
  // EVM address is stored with its EIP-55 checksum casing but may be typed in
  // any case - /profile/UQBKXR… and /profile/0xABC… both resolve.
  const isAddressLookup = lookupField === 'address' && typeof value === 'string'
  const lookupValue = isAddressLookup
    ? WalletAddress.toStorage(value as string)
    : value

  const repository = getDataSource().getRepository(target)

  let res

  if (selectOptions || relations) {
    res = await runPromise(
      AbstractRepositoryTemplate.prototype.findOneByQueryBuilder.bind({
        target,
        getRepo: () => repository,
      })({ [lookupField]: lookupValue }, selectOptions, relations),
    )
  } else {
    res = await repository.findOne({
      // Case-insensitive for an address: an EVM address is stored with its
      // EIP-55 checksum casing but may legitimately be typed in any case, and
      // the checksum is advisory rather than part of the identity.
      where: (isAddressLookup
        ? {
            [lookupField]: Raw(
              (alias) => `LOWER(${alias}) = LOWER(:addressValue)`,
              { addressValue: lookupValue },
            ),
          }
        : { [lookupField]: lookupValue }) as FindOptionsWhere<object>,
    })
  }

  if (!res) {
    const entityName: string = target.name || 'Entity'
    const messageOnNotFound = `${entityName} does not exist`
    throw new NotFoundError(messageOnNotFound)
  }

  return res
}

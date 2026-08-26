import { ResponseClassTransformOptions } from 'routing-controllers'
import { OpenAPI } from 'routing-controllers-openapi'
import { OperationObject } from 'openapi3-ts'
import { getMetadataArgsStorage as getTypeOrmMetadataArgsStorage } from 'typeorm'

import { OpenApiBodySchema } from '@/decorator/openapi/openapi-body-schema'
import { getEntityFromParamMetadata } from '@/decorator/entity-from-param'
import { OpenApiOptionalAuthorizationHeader } from '@/decorator/openapi/openapi-optional-authorization-header'
import {
  OpenApiResponseSchema,
  registerSerializationGroupOpenApi,
  serializationGroupOpenApiComponentName,
} from '@/decorator/openapi/openapi-response-schema'
import { OpenApiSearchRequestBodySchema } from '@/decorator/openapi/openapi-search-request-body-schema'

export interface OpenAPIExtendedBodyPart {
  schema: unknown
  options?: Parameters<typeof OpenApiBodySchema>[1]
}

export interface OpenAPIExtendedResponsePart<E = unknown> {
  schema: unknown
  options?: Parameters<typeof OpenApiResponseSchema>[1]
  example?: E
  transformGroups?: string[]
}

export interface OpenAPIExtendedOptions<E = unknown> {
  summary?: string
  operation?: Partial<OperationObject>
  optionalAuthorizationHeader?: boolean
  searchRequestBody?: Parameters<typeof OpenApiSearchRequestBodySchema>[0]
  body?: OpenAPIExtendedBodyPart
  response?: OpenAPIExtendedResponsePart<E>
}

export function OpenAPIExtended<E = unknown>(
  options: OpenAPIExtendedOptions<E>,
) {
  return (...args: [Function] | [object, string, PropertyDescriptor]) => {
    const inferredNotFoundResponse =
      args.length === 3
        ? inferNotFoundResponseFromEntityParam(args[0], args[1])
        : undefined
    const operation: Partial<OperationObject> = {
      ...(inferredNotFoundResponse === undefined
        ? {}
        : { responses: { 404: inferredNotFoundResponse } }),
      ...(options.operation ?? {}),
      ...(options.summary === undefined ? {} : { summary: options.summary }),
    }
    if (Object.keys(operation).length > 0) {
      OpenAPI(operation)(...args)
    }
    if (options.optionalAuthorizationHeader === true) {
      OpenApiOptionalAuthorizationHeader()(...args)
    }
    if (options.searchRequestBody != null) {
      OpenApiSearchRequestBodySchema(options.searchRequestBody)(...args)
    }
    if (options.body != null) {
      OpenApiBodySchema(
        options.body.schema,
        options.body.options ?? {},
      )(...args)
    }
    if (options.response != null) {
      const responseOptions = buildResponseOptionsWithAutoPick(
        options.response.schema,
        options.response.options ?? {},
      )
      OpenApiResponseSchema(
        options.response.schema,
        responseOptions,
        options.response.example,
      )(...args)
      const explicit = options.response.transformGroups
      const serializationGroup = responseOptions.serializationGroup
      const groups =
        explicit != null && explicit.length > 0
          ? explicit
          : serializationGroup == null
            ? undefined
            : [serializationGroup]
      if (groups != null) {
        ResponseClassTransformOptions({ groups })(...args)
      }
    }
  }
}

function buildResponseOptionsWithAutoPick(
  responseSchema: unknown,
  options: NonNullable<Parameters<typeof OpenApiResponseSchema>[1]>,
): NonNullable<Parameters<typeof OpenApiResponseSchema>[1]> {
  const serializationGroup = options.serializationGroup
  if (serializationGroup == null || options.inlineSchema != null) {
    return options
  }

  const sourceEntity = options.sourceEntity ?? responseSchema
  if (typeof sourceEntity !== 'function') {
    return options
  }

  return {
    ...options,
    pickPropertySchema: createAutoPickPropertySchema(
      sourceEntity,
      serializationGroup,
      options.pickPropertySchema,
    ),
  }
}

function createAutoPickPropertySchema(
  sourceEntity: Function,
  group: string,
  explicitPick?: NonNullable<
    Parameters<typeof OpenApiResponseSchema>[1]
  >['pickPropertySchema'],
): NonNullable<
  Parameters<typeof OpenApiResponseSchema>[1]
>['pickPropertySchema'] {
  return (entityClass, propertyName) => {
    const explicitSchema = explicitPick?.(entityClass, propertyName)
    if (explicitSchema != null) {
      return explicitSchema
    }

    const reflectedType = resolveEntityPropertyType(sourceEntity, propertyName)
    if (!reflectedType || !isEntityLikeReflectedType(reflectedType)) {
      return undefined
    }

    registerSerializationGroupOpenApi(reflectedType, group)
    const nestedSchemaName = serializationGroupOpenApiComponentName(
      reflectedType,
      group,
    )
    return { $ref: `#/components/schemas/${nestedSchemaName}` }
  }
}

function isEntityLikeReflectedType(type: Function): boolean {
  const nonEntityTypes = new Set<Function>([
    String,
    Number,
    Boolean,
    Date,
    Array,
    Object,
  ])
  return !nonEntityTypes.has(type)
}

function resolveEntityPropertyType(
  sourceEntity: Function,
  propertyName: string,
): Function | undefined {
  const reflectedType = Reflect.getMetadata(
    'design:type',
    sourceEntity.prototype,
    propertyName,
  ) as Function | undefined
  if (reflectedType && isEntityLikeReflectedType(reflectedType)) {
    return reflectedType
  }

  const relationMeta = getTypeOrmMetadataArgsStorage().relations.find(
    (relation) =>
      relation.target === sourceEntity &&
      relation.propertyName === propertyName,
  )
  const relationType = relationMeta?.type
  if (typeof relationType === 'function') {
    const type = (relationType as (type?: unknown) => Function)()
    if (typeof type === 'function' && isEntityLikeReflectedType(type)) {
      return type
    }
  }

  return reflectedType
}

function inferNotFoundResponseFromEntityParam(
  target: object,
  methodName: string,
): NonNullable<OperationObject['responses']>[number] | undefined {
  const metadata = getEntityFromParamMetadata(target, methodName)
  if (metadata.length === 0) {
    return undefined
  }

  const entityName = metadata[0].entityName
  const message = `${entityName} does not exist`

  return {
    description: message,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'NotFoundError' },
            message: { type: 'string', example: message },
          },
        },
      },
    },
  }
}

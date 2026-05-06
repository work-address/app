import { merge, isEmpty } from 'lodash'
import {
  SchemaObject,
  OperationObject,
  ReferenceObject,
  HeaderObject,
} from 'openapi3-ts'
import {
  getContentType,
  getStatusCode,
  IRoute,
  OpenAPI,
} from 'routing-controllers-openapi'

import { schemaForClassTransformGroup } from '@/decorator/openapi/schema-for-expose-group'

export function serializationGroupOpenApiComponentName(
  entityClass: Function,
  group: string,
): string {
  return `${entityClass.name}_${group}`
}

type SerializationGroupReg = {
  entityClass: Function
  group: string
  pickPropertySchema?: (
    entityClass: Function,
    propertyName: string,
  ) => SchemaObject | undefined
}

/** Populated by `OpenApiResponseSchema` / `OpenApiBodySchema` when `serializationGroup` is set; merged in `OpenApi.buildSpec`. */
const serializationGroupComponentsByName = new Map<
  string,
  SerializationGroupReg
>()

export function registerSerializationGroupOpenApi(
  entityClass: Function,
  group: string,
  pickPropertySchema?: SerializationGroupReg['pickPropertySchema'],
): string {
  const componentName = serializationGroupOpenApiComponentName(
    entityClass,
    group,
  )
  serializationGroupComponentsByName.set(componentName, {
    entityClass,
    group,
    pickPropertySchema,
  })
  return componentName
}

/** After `validationMetadatasToSchemas`, attach schemas for all serialization-group components. */
export function mergeRegisteredSerializationGroupSchemas(
  componentsSchemas: Record<string, SchemaObject>,
  classTransformerStorage: {
    getExposedMetadatas(target: Function): Array<{
      propertyName?: string
      options?: { groups?: string[] }
    }>
  },
): void {
  for (const [componentName, reg] of serializationGroupComponentsByName) {
    componentsSchemas[componentName] = schemaForClassTransformGroup(
      reg.entityClass,
      reg.group,
      componentsSchemas,
      classTransformerStorage,
      reg.pickPropertySchema,
    )
  }
}

export function OpenApiResponseSchema<E>(
  /** Schema class/DTO ctor, `{}`, primitive ctor — see decorator branches below. */
  responseSchema: unknown,
  options: OpenApiResponseSchemaOptions = {},
  example?: E,
) {
  if (options.serializationGroup != null && options.inlineSchema == null) {
    const entityClass = options.sourceEntity ?? responseSchema
    if (typeof entityClass !== 'function' || !entityClass.name) {
      throw new Error(
        'OpenApiResponseSchema: `serializationGroup` requires a named entity class (the schema argument or `sourceEntity`)',
      )
    }
    registerSerializationGroupOpenApi(
      entityClass,
      options.serializationGroup,
      options.pickPropertySchema,
    )
  }

  const setResponseSchema = (source: OperationObject, route: IRoute) => {
    const description = options.description || ''
    const contentType = options.contentType || getContentType(route)
    const statusCode = (options.statusCode || getStatusCode(route)).toString()

    if (options.emptyBody === true) {
      const merged = merge({}, source)
      merged.responses = {
        ...(source.responses || {}),
        [statusCode]: {
          description,
          ...(options.headers == null ? {} : { headers: options.headers }),
        },
      }
      return merged
    }

    let schema: SchemaObject | ReferenceObject = {}

    if (options.inlineSchema != null) {
      schema = options.inlineSchema
    } else if (
      typeof responseSchema === 'object' &&
      responseSchema !== null &&
      isEmpty(responseSchema)
    ) {
      // for {} format
      schema = { type: 'object' }
    } else if (
      Number === responseSchema ||
      String === responseSchema ||
      Boolean === responseSchema
    ) {
      const primitiveCtor = responseSchema as
        | NumberConstructor
        | StringConstructor
        | BooleanConstructor
      const schemaName = primitiveCtor.name.toLowerCase() as
        | 'number'
        | 'string'
        | 'boolean'

      if (options.isArray) {
        // for [0, 1, 2, ...] format
        schema = {
          type: 'array',
          items: { type: schemaName },
        }
      } else {
        // for single number | boolean | string format
        schema = { type: schemaName }
      }
    } else {
      if (typeof responseSchema !== 'function') {
        throw new Error(
          'OpenApiResponseSchema: expected entity class/DTO constructor for OpenAPI $ref',
        )
      }
      const responseCtor = responseSchema as { name: string }
      const entityForRef =
        options.serializationGroup == null
          ? responseSchema
          : (options.sourceEntity ?? responseSchema)
      const schemaName =
        options.serializationGroup == null
          ? responseCtor.name
          : serializationGroupOpenApiComponentName(
              entityForRef as Function,
              options.serializationGroup,
            )

      if (options.isArray) {
        // for [Entity, Entity, ...] format
        schema = {
          type: 'array',
          items: {
            $ref: `#/components/schemas/${schemaName}`,
          },
        }
      } else if (options.isPagination) {
        // for [[...Entities], 0] format
        schema = {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'array',
                items: {
                  $ref: `#/components/schemas/${schemaName}`,
                },
              },
              {
                type: 'integer',
              },
            ],
          },
        }
      } else {
        schema = {
          $ref: `#/components/schemas/${schemaName}`,
        }
      }
    }

    if (example) {
      ;(schema as SchemaObject).example = example
    }

    const responses = {
      [statusCode]: {
        content: { [contentType]: { schema } },
        description,
        ...(options.headers == null ? {} : { headers: options.headers }),
      },
    }

    const oldSchema = source.responses[statusCode]?.content[contentType].schema

    if (oldSchema?.$ref || oldSchema?.items || oldSchema?.oneOf) {
      // case where we're adding multiple schemas under single statuscode/contentType
      const newStatusCodeResponse = merge(
        {},
        source.responses[statusCode],
        responses[statusCode],
      )

      const newSchema = oldSchema.oneOf
        ? { oneOf: [...oldSchema.oneOf, schema] }
        : { oneOf: [oldSchema, schema] }

      newStatusCodeResponse.content[contentType].schema = newSchema
      source.responses[statusCode] = newStatusCodeResponse
      return source
    }

    return merge({}, source, { responses })
  }

  return (...args: [Function] | [object, string, PropertyDescriptor]) =>
    OpenAPI(setResponseSchema)(...args)
}

export interface OpenApiResponseSchemaOptions {
  contentType?: string
  description?: string
  statusCode?: string | number
  isArray?: boolean
  isPagination?: boolean
  /**
   * When set, registers `#/components/schemas/{EntityName}_{group}` (e.g. `User_search`)
   * from class-transformer `@Expose` for that group. Defaults `sourceEntity` to this
   * decorator's class argument. The base `{EntityName}` schema from class-validator
   * is unchanged.
   */
  serializationGroup?: string
  /**
   * Optional entity for expose/CV metadata; defaults to the schema class argument.
   * Use when the response class differs from the entity that owns `@Expose`.
   */
  sourceEntity?: Function
  /** For exposed properties with no class-validator metadata (e.g. `roles`). */
  pickPropertySchema?: (
    entityClass: Function,
    propertyName: string,
  ) => SchemaObject | undefined
  /** OpenAPI response headers (e.g. `Location` on 201 Created). */
  headers?: Record<string, HeaderObject | ReferenceObject>
  /**
   * When true, documents no response body (no `content` on this response).
   * Use when the API sends only headers / status with an empty body.
   */
  emptyBody?: boolean
  /**
   * Raw OpenAPI body schema when the response is not a `$ref` entity/DTO.
   * When set, the first decorator argument is ignored (pass `null`).
   */
  inlineSchema?: SchemaObject | ReferenceObject
}

export function OpenApiEmptyResponseSchema(
  options: Omit<OpenApiResponseSchemaOptions, 'emptyBody'> = {},
) {
  return OpenApiResponseSchema({}, { ...options, emptyBody: true })
}

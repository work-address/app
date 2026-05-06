import { merge, isEmpty, isUndefined } from 'lodash'
import { getContentType, IRoute, OpenAPI } from 'routing-controllers-openapi'
import {
  SchemaObject,
  OperationObject,
  RequestBodyObject,
  ReferenceObject,
} from 'openapi3-ts'

import {
  registerSerializationGroupOpenApi,
  serializationGroupOpenApiComponentName,
} from '@/decorator/openapi/openapi-response-schema'

export function OpenApiBodySchema<E>(
  /** Entity/DTO constructor, `{}`, `Number|String|Boolean`, or multipart field name — see decorator branches below. */
  bodySchema: unknown,
  options: {
    contentType?: string
    description?: string
    isFile?: boolean
    isArray?: boolean
    isRequired?: boolean
    /**
     * When set, request body references `#/components/schemas/{EntityName}_{group}`
     * (e.g. `User_edit`) from `@Expose` for that group; align with `@Body` transform groups.
     */
    serializationGroup?: string
    /** Entity for expose/CV metadata; defaults to the schema class argument. */
    sourceEntity?: Function
    pickPropertySchema?: (
      entityClass: Function,
      propertyName: string,
    ) => SchemaObject | undefined
    /** Example value for this request body in OpenAPI / Swagger UI. */
    example?: E
  } = {},
) {
  if (options.serializationGroup != null) {
    const entityClass = options.sourceEntity ?? bodySchema
    if (typeof entityClass !== 'function' || !entityClass.name) {
      throw new Error(
        'OpenApiBodySchema: `serializationGroup` requires a named entity class (the schema argument or `sourceEntity`)',
      )
    }
    registerSerializationGroupOpenApi(
      entityClass,
      options.serializationGroup,
      options.pickPropertySchema,
    )
  }

  const setBodySchema = (source: OperationObject, route: IRoute) => {
    const description = options.description || ''
    const contentType = options.contentType || getContentType(route)
    const isRequired = isUndefined(options.isRequired)
      ? true
      : options.isRequired

    let schema: SchemaObject | ReferenceObject = {}

    if (typeof bodySchema === 'object' && isEmpty(bodySchema)) {
      // for {} format
      schema = { type: 'object' }
    } else if (
      Number === bodySchema ||
      String === bodySchema ||
      Boolean === bodySchema
    ) {
      const primitiveCtor = bodySchema as
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
    } else if (options.isFile) {
      // for file format
      const fileName: string =
        (typeof bodySchema === 'string' && bodySchema) || 'fileName'

      if (options.isArray) {
        schema = {
          type: 'object',
          properties: {
            [fileName]: {
              type: 'array',
              items: {
                type: 'string',
                format: 'binary',
              },
            },
          },
        }
      } else {
        schema = {
          type: 'object',
          properties: {
            [fileName]: {
              type: 'string',
              format: 'binary',
            },
          },
        }
      }
    } else {
      if (typeof bodySchema !== 'function') {
        throw new Error(
          'OpenApiBodySchema: expected entity class/DTO constructor for OpenAPI $ref',
        )
      }
      const entityCtor = bodySchema as { name: string }
      const entityForRef =
        options.serializationGroup == null
          ? bodySchema
          : (options.sourceEntity ?? bodySchema)
      const schemaName =
        options.serializationGroup == null
          ? entityCtor.name
          : serializationGroupOpenApiComponentName(
              entityForRef as Function,
              options.serializationGroup,
            )

      if (options.isArray) {
        // for Entity[] format
        schema = {
          type: 'array',
          items: {
            $ref: `#/components/schemas/${schemaName}`,
          },
        }
      } else {
        schema = {
          $ref: `#/components/schemas/${schemaName}`,
        }
      }
    }

    const requestBody: RequestBodyObject = {
      content: {
        [contentType]: {
          schema,
        },
      },
      description,
      required: isRequired,
    }

    if (options.example !== undefined) {
      requestBody.content[contentType].example = options.example
    }

    return merge({}, source, { requestBody })
  }

  return (...args: [Function] | [object, string, PropertyDescriptor]) =>
    OpenAPI(setBodySchema)(...args)
}

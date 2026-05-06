import { merge, isUndefined } from 'lodash'
import { getContentType, IRoute, OpenAPI } from 'routing-controllers-openapi'
import {
  OperationObject,
  ReferenceObject,
  RequestBodyObject,
  SchemaObject,
} from 'openapi3-ts'

const searchPagingProperties: SchemaObject['properties'] = {
  page: {
    type: 'integer',
    minimum: 0,
    description: 'Zero-based page index',
  },
  sort: {
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Map of field name to sort direction (ASC or DESC)',
  },
  limit: { type: 'integer', description: 'Optional page size override' },
}

const defaultFilterSchema: SchemaObject = {
  type: 'object',
  additionalProperties: true,
  description: 'Endpoint-specific filters (see summary / examples)',
}

function buildSearchRequestSchema(
  filterSchema: SchemaObject | ReferenceObject,
): SchemaObject {
  return {
    type: 'object',
    required: ['page', 'filter', 'sort'],
    properties: {
      ...searchPagingProperties,
      filter: filterSchema,
    },
  }
}

/**
 * OpenAPI request body for `POST …/search` (paging + `filter` + `sort`), merged like {@link OpenApiBodySchema}.
 */
export function OpenApiSearchRequestBodySchema(
  options: {
    /** Replaces the default permissive `filter` object; omit for generic search filters. */
    filter?: SchemaObject
    description?: string
    example?: unknown
    contentType?: string
    isRequired?: boolean
  } = {},
) {
  let filterSchema: SchemaObject | ReferenceObject = defaultFilterSchema
  if (options.filter != null) {
    filterSchema = options.filter
  }

  const schema = buildSearchRequestSchema(filterSchema)

  const setBodySchema = (source: OperationObject, route: IRoute) => {
    const contentType = options.contentType || getContentType(route)
    const isRequired = isUndefined(options.isRequired)
      ? true
      : options.isRequired

    const content: RequestBodyObject['content'] = {
      [contentType]: {
        schema,
        ...(options.example === undefined ? {} : { example: options.example }),
      },
    }

    const requestBody: RequestBodyObject = {
      content,
      description: options.description ?? '',
      required: isRequired,
    }

    return merge({}, source, { requestBody })
  }

  return (...args: [Function] | [object, string, PropertyDescriptor]) =>
    OpenAPI(setBodySchema)(...args)
}

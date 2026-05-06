import { OpenAPI } from 'routing-controllers-openapi'
import type { OperationObject, ParameterObject } from 'openapi3-ts'

const OPTIONAL_AUTH_HEADER: ParameterObject = {
  in: 'header',
  name: 'Authorization',
  required: false,
  schema: { type: 'string' },
}

/** Merges an optional `Authorization` header into the operation (path/query stay from routing metadata). */
export function OpenApiOptionalAuthorizationHeader() {
  return OpenAPI((source: OperationObject) => ({
    ...source,
    parameters: [...(source.parameters ?? []), OPTIONAL_AUTH_HEADER],
  }))
}

import type { OpenAPIObject } from 'openapi3-ts'
import type { MetadataArgsStorage } from 'routing-controllers'
import type { RoutingControllersOptions } from 'routing-controllers'

import { expressToOpenAPIPath, parseRoutes } from 'routing-controllers-openapi'

function fullExpressPath(
  route: ReturnType<typeof parseRoutes>[number],
): string {
  const { action, controller, options } = route
  if (typeof action.route !== 'string') {
    return ''
  }
  return (options.routePrefix || '') + (controller.route || '') + action.route
}

function actionRequiresAuth(
  storage: MetadataArgsStorage,
  target: Function,
  method: string,
): boolean {
  if (
    storage
      .filterResponseHandlersWithTargetAndMethod(target, method)
      .some((h) => h.type === 'authorized')
  ) {
    return true
  }
  return storage
    .filterResponseHandlersWithTarget(target)
    .some((h) => h.type === 'authorized' && h.method == null)
}

/** Sets `operation.security` for actions (or whole controllers) marked `@Authorized`. */
export function applyBearerAuthSecurity(
  spec: OpenAPIObject,
  storage: MetadataArgsStorage,
  routingControllersOptions: RoutingControllersOptions,
): void {
  const routes = parseRoutes(storage, routingControllersOptions)
  for (const route of routes) {
    if (
      !actionRequiresAuth(storage, route.action.target, route.action.method)
    ) {
      continue
    }
    const expressPath = fullExpressPath(route)
    if (!expressPath) {
      continue
    }
    const openApiPath = expressToOpenAPIPath(expressPath)
    const method = route.action.type
    const pathItem = spec.paths?.[openApiPath]
    if (!pathItem || typeof pathItem !== 'object') {
      continue
    }
    const operation = pathItem[method as keyof typeof pathItem]
    if (!operation || typeof operation !== 'object' || '$ref' in operation) {
      continue
    }
    ;(operation as { security?: Array<Record<string, string[]>> }).security = [
      { bearerAuth: [] },
    ]
  }
}

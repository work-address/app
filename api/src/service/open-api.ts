import { getMetadataArgsStorage } from 'routing-controllers'
import { routingControllersToSpec } from 'routing-controllers-openapi'
import { validationMetadatasToSchemas } from 'class-validator-jsonschema'
import { injectable } from 'inversify'
import type { OpenAPIObject } from 'openapi3-ts'

import { mergeRegisteredSerializationGroupSchemas } from '@/decorator/openapi/openapi-response-schema'
import { applyBearerAuthSecurity } from '@/decorator/openapi/apply-bearer-auth-security'

/**
 * Where the service-to-service controllers live (`@JsonController('/internal')`
 * under the `/api` prefix): the entitlement push and the marketplace hire.
 */
const INTERNAL_PATH_PREFIX = '/api/internal/'

const SCHEMA_REF_PREFIX = '#/components/schemas/'

@injectable()
export class OpenApi {
  public buildSpec() {
    const { defaultMetadataStorage } = require('class-transformer/cjs/storage')
    const routingControllersOptions = {
      routePrefix: '/api',
    }
    const storage = getMetadataArgsStorage()
    const schemas = validationMetadatasToSchemas({
      classTransformerMetadataStorage: defaultMetadataStorage,
      refPointerPrefix: '#/components/schemas/',
    })

    mergeRegisteredSerializationGroupSchemas(schemas, defaultMetadataStorage)

    // storage.controllers = storage.controllers.filter(c => this.isDisplayed(c.target));
    // storage.actions = storage.actions.filter(c => this.isDisplayed(c.target));

    const spec = routingControllersToSpec(storage, routingControllersOptions, {
      components: {
        schemas,
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'JWT access token (same value the API returns on login)',
          },
        },
      },
      info: {
        title: 'API schema',
        version: 'v1',
      },
    })

    applyBearerAuthSecurity(spec, storage, routingControllersOptions)
    this.omitInternalRoutes(spec)

    return spec
  }

  /**
   * Leaves the service-to-service routes out, with the schemas only they use.
   * This spec is what both browser clients are generated from and what the
   * public docs show. Those routes answer another service that signs its body
   * with a shared secret, never a signed-in user, so a generated browser
   * function for one is only an invitation to call it from the wrong side.
   */
  private omitInternalRoutes(spec: OpenAPIObject): void {
    const schemas = spec.components?.schemas ?? {}
    const internal = Object.keys(spec.paths).filter((path) =>
      path.startsWith(INTERNAL_PATH_PREFIX),
    )
    const internalSchemas = OpenApi.reachableSchemas(
      internal.map((path) => spec.paths[path]),
      schemas,
    )

    for (const path of internal) {
      delete spec.paths[path]
    }

    const publicSchemas = OpenApi.reachableSchemas([spec.paths], schemas)

    for (const name of internalSchemas) {
      if (!publicSchemas.has(name)) {
        delete schemas[name]
      }
    }
  }

  /** Every component schema `roots` point at, directly or through another schema. */
  private static reachableSchemas(
    roots: unknown[],
    schemas: Record<string, unknown>,
  ): Set<string> {
    const reached = new Set<string>()
    const pending = roots.flatMap((root) => OpenApi.schemaRefs(root))

    while (pending.length) {
      const name = pending.pop() as string

      if (!reached.has(name)) {
        reached.add(name)
        pending.push(...OpenApi.schemaRefs(schemas[name]))
      }
    }

    return reached
  }

  /** Names of the component schemas `value` points at, at any depth. */
  private static schemaRefs(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => OpenApi.schemaRefs(item))
    }

    if (value === null || typeof value !== 'object') {
      return []
    }

    return Object.entries(value).flatMap(([key, item]) =>
      key === '$ref' &&
      typeof item === 'string' &&
      item.startsWith(SCHEMA_REF_PREFIX)
        ? [item.slice(SCHEMA_REF_PREFIX.length)]
        : OpenApi.schemaRefs(item),
    )
  }
}

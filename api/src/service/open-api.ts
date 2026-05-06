import { getMetadataArgsStorage } from 'routing-controllers'
import { routingControllersToSpec } from 'routing-controllers-openapi'
import { validationMetadatasToSchemas } from 'class-validator-jsonschema'
import { injectable } from 'inversify'

import { mergeRegisteredSerializationGroupSchemas } from '@/decorator/openapi/openapi-response-schema'
import { applyBearerAuthSecurity } from '@/decorator/openapi/apply-bearer-auth-security'

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

    return spec
  }
}

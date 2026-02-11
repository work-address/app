import {getMetadataArgsStorage} from 'routing-controllers';
import {routingControllersToSpec} from 'routing-controllers-openapi';
import {validationMetadatasToSchemas} from 'class-validator-jsonschema';
import {injectable} from 'inversify';

@injectable()
export class OpenApi {
  public buildSpec() {
    const {defaultMetadataStorage} = require('class-transformer/cjs/storage');
    const routingControllersOptions = {
      routePrefix: '/api',
    };
    const storage = getMetadataArgsStorage();
    const schemas = validationMetadatasToSchemas({
      classTransformerMetadataStorage: defaultMetadataStorage,
      refPointerPrefix: '#/components/schemas/',
    });

    // storage.controllers = storage.controllers.filter(c => this.isDisplayed(c.target));
    // storage.actions = storage.actions.filter(c => this.isDisplayed(c.target));

    const spec = routingControllersToSpec(storage, routingControllersOptions, {
      components: {
        schemas,
        securitySchemes: {
          basicAuth: {
            scheme: 'basic',
            type: 'http',
          },
        },
      },
      info: {
        title: 'API schema',
        version: 'v1',
      },
    });

    return spec;
  }
}

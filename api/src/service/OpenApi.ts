import {getMetadataArgsStorage} from 'routing-controllers';
import {routingControllersToSpec} from 'routing-controllers-openapi';
import {validationMetadatasToSchemas} from 'class-validator-jsonschema';
import {injectable} from 'inversify';
import type {ParameterObject, ResponseObject, SchemaObject} from 'openapi3-ts';

@injectable()
export class OpenApi {
  /** Shared request body schema for paged search endpoints. */
  static readonly searchRequestBodySchema: SchemaObject = {
    type: 'object',
    required: ['page', 'filter', 'sort'],
    properties: {
      page: {
        type: 'integer',
        minimum: 0,
        description: 'Zero-based page index',
      },
      filter: {
        type: 'object',
        additionalProperties: true,
        description: 'Endpoint-specific filters (see summary / examples)',
      },
      sort: {
        type: 'object',
        additionalProperties: {type: 'string'},
        description: 'Map of field name to sort direction (ASC or DESC)',
      },
      query: {type: 'string', description: 'Optional free-text query'},
      limit: {type: 'integer', description: 'Optional page size override'},
    },
  };

  /** Response shape from repository tuple: [rows, totalCount]. */
  static readonly paginatedTupleResponse: ResponseObject = {
    description:
      'Paginated pair: index `0` is the array of entities, index `1` is the total count (number).',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: {},
        },
        example: [[], 0],
      },
    },
  };

  static readonly bearerAuthParameter: ParameterObject = {
    in: 'header',
    name: 'Authorization',
    required: true,
    schema: {type: 'string'},
    description:
      'JWT access token (same value the API returns in the Authorization header on login)',
  };

  static readonly emptyObjectResponse: ResponseObject = {
    description: 'Empty JSON object',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {},
        },
      },
    },
  };

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

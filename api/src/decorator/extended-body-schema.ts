import {merge, isEmpty, isUndefined} from 'lodash';
import {getContentType, IRoute, OpenAPI} from 'routing-controllers-openapi';
import {SchemaObject, OperationObject, RequestBodyObject} from 'openapi3-ts';

export function ExtendedBodySchema<E>(
  bodySchema: any,
  options: {
    contentType?: string;
    description?: string;
    isFile?: boolean;
    isArray?: boolean;
    isRequired?: boolean;
  } = {},
  example?: E
) {
  const setBodySchema = (source: OperationObject, route: IRoute) => {
    const description = options.description || '';
    const contentType = options.contentType || getContentType(route);
    const isRequired = isUndefined(options.isRequired) ? true : options.isRequired;

    let schema: SchemaObject = {};

    if (typeof bodySchema === 'object' && isEmpty(bodySchema)) {
      // for {} format
      schema = {type: 'object'};
    } else if (Number === bodySchema || String === bodySchema || Boolean === bodySchema) {
      const schemaName: 'number' | 'string' | 'boolean' = bodySchema.name.toLowerCase();

      if (options.isArray) {
        // for [0, 1, 2, ...] format
        schema = {
          type: 'array',
          items: {type: schemaName},
        };
      } else {
        // for single number | boolean | string format
        schema = {type: schemaName};
      }
    } else if (options.isFile) {
      // for file format
      const fileName = bodySchema || 'fileName';

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
        };
      } else {
        schema = {
          type: 'object',
          properties: {
            [fileName]: {
              type: 'string',
              format: 'binary',
            },
          },
        };
      }
    } else {
      const schemaName: string = bodySchema.name;

      if (options.isArray) {
        // for Entity[] format
        schema = {
          type: 'array',
          items: {
            $ref: `#/components/schemas/${schemaName}`,
          },
        };
      } else {
        schema = {
          $ref: `#/components/schemas/${schemaName}`,
        };
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
    };

    if (example) {
      requestBody.content[contentType].example = example;
    }

    return merge({}, source, {requestBody});
  };

  return (...args: any) => OpenAPI(setBodySchema)(...args);
}

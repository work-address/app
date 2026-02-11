import {merge, isEmpty} from 'lodash';
import {SchemaObject, OperationObject} from 'openapi3-ts';
import {getContentType, getStatusCode, IRoute, OpenAPI} from 'routing-controllers-openapi';

export function ExtendedResponseSchema<E>(
  responseSchema: any,
  options: {
    contentType?: string;
    description?: string;
    statusCode?: string | number;
    isArray?: boolean;
    isPagination?: boolean;
  } = {},
  example?: E
) {
  const setResponseSchema = (source: OperationObject, route: IRoute) => {
    const description = options.description || '';
    const contentType = options.contentType || getContentType(route);
    const statusCode = (options.statusCode || getStatusCode(route)).toString();

    let schema: SchemaObject = {};

    if (typeof responseSchema === 'object' && isEmpty(responseSchema)) {
      // for {} format
      schema = {type: 'object'};
    } else if (
      Number === responseSchema ||
      String === responseSchema ||
      Boolean === responseSchema
    ) {
      const schemaName: 'number' | 'string' | 'boolean' = responseSchema.name.toLowerCase();

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
    } else {
      const schemaName: string = responseSchema.name;

      if (options.isArray) {
        // for [Entity, Entity, ...] format
        schema = {
          type: 'array',
          items: {
            $ref: `#/components/schemas/${schemaName}`,
          },
        };
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
        };
      } else {
        schema = {
          $ref: `#/components/schemas/${schemaName}`,
        };
      }
    }

    if (example) {
      schema.example = example;
    }

    const responses = {
      [statusCode]: {
        content: {[contentType]: {schema}},
        description,
      },
    };

    const oldSchema = source.responses[statusCode]?.content[contentType].schema;

    if (oldSchema?.$ref || oldSchema?.items || oldSchema?.oneOf) {
      // case where we're adding multiple schemas under single statuscode/contentType
      const newStatusCodeResponse = merge({}, source.responses[statusCode], responses[statusCode]);

      const newSchema = oldSchema.oneOf
        ? {oneOf: [...oldSchema.oneOf, schema]}
        : {oneOf: [oldSchema, schema]};

      newStatusCodeResponse.content[contentType].schema = newSchema;
      source.responses[statusCode] = newStatusCodeResponse;
      return source;
    }

    return merge({}, source, {responses});
  };

  return (...args: any) => OpenAPI(setResponseSchema)(...args);
}

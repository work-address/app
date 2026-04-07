import {Get, JsonController} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';

import {App} from '../app/App';
import {OpenApi} from '../service/OpenApi';

@JsonController('/help')
export class HelpController {
  protected openApi: OpenApi;

  constructor() {
    this.openApi = App.container.get('OpenApi');
  }

  @OpenAPI({
    summary: 'OpenAPI 3 specification (JSON)',
    description:
      'Same document used to drive `/swagger` UI: full API schema generated from controllers and decorators.',
    responses: {
      200: {
        description: 'OpenAPI 3.0 document',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: 'Valid OpenAPI object (openapi, info, paths, components, …)',
            },
          },
        },
      },
    },
  })
  @Get('/openApi')
  public swagger() {
    return this.openApi.buildSpec();
  }
}

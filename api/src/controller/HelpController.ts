import {Get, JsonController} from 'routing-controllers';

import {App} from '../app/App';
import {OpenApi} from '../service/OpenApi';

@JsonController('/help')
export class HelpController {
  protected openApi: OpenApi;

  constructor() {
    this.openApi = App.container.get('OpenApi');
  }

  @Get('/openApi')
  public swagger() {
    return this.openApi.buildSpec();
  }
}

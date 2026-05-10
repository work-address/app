import { Get, Header, HttpCode, JsonController } from 'routing-controllers'
import { OpenAPI } from 'routing-controllers-openapi'

import { App } from '@/app/app'
import { OpenApi } from '@/service/open-api'

@JsonController('/help')
export class HelpController {
  protected openApi: OpenApi

  constructor() {
    this.openApi = App.container.get('OpenApi')
  }

  @OpenAPI({
    summary: 'OpenAPI 3 specification (JSON)',
  })
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @HttpCode(200)
  @Get('/openApi')
  public swagger() {
    return this.openApi.buildSpec()
  }
}

import { Get, HttpCode, JsonController } from 'routing-controllers'

import { App } from '@/app/app'
import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { IIdentityConfig } from '@/model/identity'
import { IdentityManager } from '@/service/identity-manager'

/**
 * Portable identity, part of the User domain: the profile it anchors is the
 * user's own. Routes about one user's presentation live on /user.
 */
@JsonController('/identity')
export class IdentityController {
  protected identityManager: IdentityManager

  constructor() {
    this.identityManager = App.container.get('IdentityManager')
  }

  @OpenAPIExtended({
    summary:
      'Where this instance anchors profile commitments (public); enabled is false when anchoring is not configured',
    response: {
      schema: null,
      options: {
        inlineSchema: {
          type: 'object',
          required: [
            'enabled',
            'chainId',
            'registryAddress',
            'manifestUrl',
            'schemaIds',
            'relayEnabled',
          ],
          properties: {
            enabled: { type: 'boolean' },
            chainId: { type: 'integer', nullable: true },
            registryAddress: { type: 'string', nullable: true },
            manifestUrl: { type: 'string', nullable: true },
            schemaIds: { type: 'array', items: { type: 'integer' } },
            relayEnabled: { type: 'boolean' },
          },
        },
      },
    },
  })
  @Get('/config')
  @HttpCode(200)
  public config(): IIdentityConfig {
    return this.identityManager.getConfig()
  }
}

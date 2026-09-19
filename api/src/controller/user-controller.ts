import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Post,
  Put,
  Res,
} from 'routing-controllers'
import { SchemaObject } from 'openapi3-ts'
import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import { UserManager } from '@/service/user-manager'
import { IdentityManager } from '@/service/identity-manager'
import { CurrentUser, OptionalCurrentUser } from '@/decorator/current-user'
import { UserRepository } from '@/repository/user-repository'
import { UserSearchDto } from '@/model/dto/user'
import { IdentityPublishDto } from '@/model/dto/identity'
import {
  EIdentityChainEventKind,
  EIdentityChainResult,
  EIdentitySaltCustody,
  EIdentityUnavailable,
  IIdentityPublication,
  IIdentityRemoval,
  IIdentityView,
} from '@/model/identity'
import { EntityFromParam } from '@/decorator/entity-from-param'
import express from 'express'
import { runPromise } from '@/service/effect-bridge'
import type { ProfileExport } from '@/vendor/identity'

const IDENTITY_STATUS_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'result',
    'subjectDeactivated',
    'checkedAtBlock',
    'finalized',
    'unavailable',
  ],
  properties: {
    // OpenAPI 3.0: a nullable enum lists null among its values.
    result: {
      type: 'string',
      enum: [...Object.values(EIdentityChainResult), null],
      nullable: true,
    },
    subjectDeactivated: { type: 'boolean', nullable: true },
    checkedAtBlock: { type: 'integer', nullable: true },
    finalized: { type: 'boolean' },
    unavailable: {
      type: 'string',
      enum: [...Object.values(EIdentityUnavailable), null],
      nullable: true,
    },
  },
}

const IDENTITY_EVENT_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'kind',
    'version',
    'schemaId',
    'commitment',
    'at',
    'blockNumber',
    'transactionHash',
    'logIndex',
  ],
  properties: {
    kind: { type: 'string', enum: Object.values(EIdentityChainEventKind) },
    version: { type: 'integer' },
    schemaId: { type: 'integer', nullable: true },
    commitment: { type: 'string', nullable: true },
    at: { type: 'string', format: 'date-time' },
    blockNumber: { type: 'integer' },
    transactionHash: { type: 'string' },
    logIndex: { type: 'integer' },
  },
}

const IDENTITY_VIEW_PROPERTIES: Record<string, SchemaObject> = {
  address: { type: 'string' },
  subject: { type: 'string' },
  version: { type: 'integer' },
  // A work-address/profile-presentation v1 document, exactly as anchored.
  presentation: { type: 'object', additionalProperties: true },
  status: IDENTITY_STATUS_SCHEMA,
  history: { type: 'array', items: IDENTITY_EVENT_SCHEMA, nullable: true },
}

const IDENTITY_VIEW_SCHEMA: SchemaObject = {
  type: 'object',
  required: Object.keys(IDENTITY_VIEW_PROPERTIES),
  properties: IDENTITY_VIEW_PROPERTIES,
}

const IDENTITY_PUBLICATION_SCHEMA: SchemaObject = {
  type: 'object',
  required: [...Object.keys(IDENTITY_VIEW_PROPERTIES), 'custody'],
  properties: {
    ...IDENTITY_VIEW_PROPERTIES,
    custody: { type: 'string', enum: Object.values(EIdentitySaltCustody) },
  },
}

const IDENTITY_REMOVAL_SCHEMA: SchemaObject = {
  type: 'object',
  required: ['removed', 'exportRemoved', 'chainUnchanged', 'message'],
  properties: {
    removed: { type: 'boolean' },
    exportRemoved: { type: 'boolean' },
    chainUnchanged: { type: 'boolean' },
    message: { type: 'string' },
  },
}

@JsonController('/user')
export class UserController {
  protected userManager: UserManager
  protected identityManager: IdentityManager
  protected userRepository: UserRepository

  constructor() {
    this.userManager = App.container.get('UserManager')
    this.identityManager = App.container.get('IdentityManager')
    this.userRepository = App.container.get('UserRepository')
  }

  /**
   * Any signed-in account can page through every other one here, so rows
   * use `search`, which carries no email, phone, roles or plan, and hidden
   * profiles other than the caller's own are left out.
   */
  @OpenAPIExtended({
    summary: 'Search users',
    searchRequestBody: {
      example: {
        filter: { role: EUserRole.ROLE_USER },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
    },
    response: {
      schema: User,
      options: { isPagination: true, serializationGroup: 'search' },
    },
  })
  @Authorized([EUserRole.ROLE_USER])
  @Post('/search')
  public search(
    @CurrentUser() currentUser: User,
    @Body() search: UserSearchDto,
  ) {
    return runPromise(this.userRepository.findAndCount(search, currentUser))
  }

  /**
   * Anonymous, so it answers with the narrowest projection: what the profile
   * page shows (PRODUCT.md 4.7) and nothing more. The caller's own contact
   * details and plan come from GET /auth/status, never from here.
   *
   * A hidden profile is 404 unless the token is its holder's.
   */
  @OpenAPIExtended({
    summary:
      'Public profile by wallet address; a hidden profile is found only by its holder',
    optionalAuthorizationHeader: true,
    response: {
      schema: User,
      options: { serializationGroup: 'public' },
    },
  })
  @Get('/:address/address')
  public async read(
    @EntityFromParam({ paramName: 'address', lookupField: 'address' })
    user: User,
    @OptionalCurrentUser() viewer: User | null,
  ): Promise<User> {
    return runPromise(this.userManager.readProfile(user, viewer))
  }

  @OpenAPIExtended({
    summary: 'Update current user profile',
    body: {
      schema: User,
      options: { serializationGroup: 'edit' },
    },
    response: {
      schema: {},
      options: { emptyBody: true, statusCode: 204 },
    },
  })
  @Put()
  @HttpCode(204)
  @Authorized([EUserRole.ROLE_USER])
  public async edit(
    @CurrentUser() currentUser: User,
    @Body({ validate: { groups: ['edit'] }, transform: { groups: ['edit'] } })
    data: User,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await runPromise(this.userManager.editValidateAndSave(currentUser, data))

    res.status(204).end()
    return res
  }

  /**
   * Hosts the caller's anchored profile presentation, after the holder's own
   * wallet published its commitment to IdentityRegistry. See
   * IdentityManager.publish for every check, and SPEC.md for salt custody:
   * under the default, hosted custody, the private export is stored too.
   */
  @OpenAPIExtended({
    summary:
      "Host the caller's current anchored profile presentation (EVM accounts only); verified offline and against IdentityRegistry, and stored only if it is the current version",
    operation: {
      responses: {
        403: { description: "The presentation's subject is another account" },
        409: {
          description:
            'The registry does not hold it as the current version: unpublished, superseded, withdrawn, or another commitment or schema',
        },
        422: {
          description:
            'The account cannot be anchored (TON, Solana), or the presentation or export does not verify, or names another registry',
        },
        503: {
          description:
            'Anchoring is not configured here, or the chain could not be read; says nothing about the presentation',
        },
      },
    },
    body: { schema: IdentityPublishDto },
    response: {
      schema: null,
      options: { inlineSchema: IDENTITY_PUBLICATION_SCHEMA },
    },
  })
  @Put('/identity')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public publishIdentity(
    @CurrentUser() currentUser: User,
    @Body() body: IdentityPublishDto,
  ): Promise<IIdentityPublication> {
    return runPromise(this.identityManager.publish(currentUser, body))
  }

  @OpenAPIExtended({
    summary:
      'Remove the hosted presentation and any held export; IdentityRegistry and copies elsewhere are unchanged',
    response: {
      schema: null,
      options: { inlineSchema: IDENTITY_REMOVAL_SCHEMA },
    },
  })
  @Delete('/identity')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public removeIdentity(
    @CurrentUser() currentUser: User,
  ): Promise<IIdentityRemoval> {
    return runPromise(this.identityManager.remove(currentUser))
  }

  @OpenAPIExtended({
    summary:
      "The caller's private export, held under hosted salt custody: every field's value and salt",
    response: {
      schema: null,
      options: {
        inlineSchema: { type: 'object', additionalProperties: true },
      },
    },
  })
  @Get('/identity/export')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public identityExport(
    @CurrentUser() currentUser: User,
  ): Promise<ProfileExport> {
    return runPromise(this.identityManager.heldExportOf(currentUser))
  }

  @OpenAPIExtended({
    summary:
      "An account's hosted profile presentation, with the registry's answer about it now and its version history; a hidden profile is found only by its holder",
    optionalAuthorizationHeader: true,
    response: {
      schema: null,
      options: { inlineSchema: IDENTITY_VIEW_SCHEMA },
    },
  })
  @Get('/:address/identity')
  @HttpCode(200)
  public readIdentity(
    @EntityFromParam({ paramName: 'address', lookupField: 'address' })
    user: User,
    @OptionalCurrentUser() viewer: User | null,
  ): Promise<IIdentityView> {
    return runPromise(this.identityManager.read(user, viewer))
  }
}

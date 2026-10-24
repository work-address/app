import {
  Authorized,
  Body,
  Get,
  HttpCode,
  JsonController,
  Post,
  QueryParams,
} from 'routing-controllers'

import { App } from '@/app/app'
import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { EUserRole } from '@/model/user'
import {
  AdminUserDto,
  AdminUserSearchDto,
  AdminUserStatsDto,
  AdminUserStatsQueryDto,
} from '@/model/dto/admin'
import { AdminUserManager } from '@/service/admin-user-manager'
import { runPromise } from '@/service/effect-bridge'

/** Read-only account data for the address.work admin dashboard. */
@Authorized([EUserRole.ROLE_ADMIN])
@JsonController('/admin')
export class AdminController {
  private manager = App.container.get<AdminUserManager>('AdminUserManager')

  @OpenAPIExtended({
    summary: 'Search every account (admin only), newest first',
    body: { schema: AdminUserSearchDto },
    response: { schema: AdminUserDto, options: { isPagination: true } },
  })
  @Post('/user/search')
  @HttpCode(200)
  search(@Body() search: AdminUserSearchDto) {
    return runPromise(this.manager.search(search))
  }

  @OpenAPIExtended({
    summary: 'Account totals, actives and daily signups (admin only)',
    response: { schema: AdminUserStatsDto },
  })
  @Get('/user/stats')
  stats(@QueryParams() query: AdminUserStatsQueryDto) {
    return runPromise(this.manager.stats(query.days))
  }
}

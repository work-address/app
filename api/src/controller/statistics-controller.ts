import {
  Authorized,
  Body,
  JsonController,
  Param,
  Post,
  HttpCode,
} from 'routing-controllers'
import { App } from '@/app/app'
import { CurrentUser } from '@/decorator/current-user'
import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import { StatisticsQueryDto } from '@/model/dto/statistics'
import { StatisticsManager } from '@/service/statistics-manager'

@Authorized([EUserRole.ROLE_USER])
@JsonController('/statistics')
export class StatisticsController {
  private manager = App.container.get<StatisticsManager>('StatisticsManager')
  @Post('/overview')
  @HttpCode(200)
  @OpenAPIExtended({
    summary: 'Visible time and usage totals',
    body: { schema: StatisticsQueryDto },
  })
  overview(@Body() query: StatisticsQueryDto, @CurrentUser() user: User) {
    return this.manager.read('overview', query, user)
  }

  @Post('/apps/:kind')
  @HttpCode(200)
  @OpenAPIExtended({
    summary: 'App summary, daily, ranking, titles, workers or projects',
    body: { schema: StatisticsQueryDto },
  })
  apps(
    @Param('kind') kind: string,
    @Body() query: StatisticsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.manager.read(kind, query, user)
  }
}

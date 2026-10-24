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

  @Post('/time/daily')
  @HttpCode(200)
  @OpenAPIExtended({
    summary: 'Tracked time per day and project',
    body: { schema: StatisticsQueryDto },
  })
  timeDaily(@Body() query: StatisticsQueryDto, @CurrentUser() user: User) {
    return this.manager.timeDaily(query, user)
  }

  @Post('/time/hourly')
  @HttpCode(200)
  @OpenAPIExtended({
    summary: "The caller's active time by weekday and hour",
    body: { schema: StatisticsQueryDto },
  })
  timeHourly(@Body() query: StatisticsQueryDto, @CurrentUser() user: User) {
    return this.manager.timeHourly(query, user)
  }

  @Post('/insights/me')
  @HttpCode(200)
  @OpenAPIExtended({
    summary:
      "The caller's focus sessions, productive hours, active ratio and input per active hour",
    body: { schema: StatisticsQueryDto },
  })
  insightsMe(@Body() query: StatisticsQueryDto, @CurrentUser() user: User) {
    return this.manager.insightsMe(query, user)
  }

  @Post('/agents/daily')
  @HttpCode(200)
  @OpenAPIExtended({
    summary:
      'Agent time per day and product, assisted and autonomous, and run counts',
    body: { schema: StatisticsQueryDto },
  })
  agentsDaily(@Body() query: StatisticsQueryDto, @CurrentUser() user: User) {
    return this.manager.agentsDaily(query, user)
  }

  @Post('/team')
  @HttpCode(200)
  @OpenAPIExtended({
    summary: "Each person's time on the caller's own projects, sorted by name",
    body: { schema: StatisticsQueryDto },
  })
  team(@Body() query: StatisticsQueryDto, @CurrentUser() user: User) {
    return this.manager.team(query, user)
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

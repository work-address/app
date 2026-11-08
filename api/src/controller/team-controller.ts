import { Authorized, Get, JsonController } from 'routing-controllers'
import { App } from '@/app/app'
import { CurrentUser } from '@/decorator/current-user'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import { TeamManager } from '@/service/team-manager'

@JsonController()
export class TeamController {
  private team = App.container.get<TeamManager>('TeamManager')

  @Authorized([EUserRole.ROLE_USER])
  @Get('/team')
  read(@CurrentUser() user: User) {
    return this.team.read(user)
  }
}

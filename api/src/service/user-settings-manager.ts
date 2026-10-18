import { inject, injectable } from 'inversify'
import { UserRepository } from '@/repository/user-repository'
import { User } from '@/entity/user'
import { UserSettingsDto } from '@/model/dto/user-settings'
import { runPromise } from '@/service/effect-bridge'
import { validateOrReject } from 'class-validator'

@injectable()
export class UserSettingsManager {
  @inject('UserRepository') protected repository: UserRepository
  public async read(user: User): Promise<UserSettingsDto> {
    const stored = await runPromise(this.repository.findOneByIdOrFail(user.id))
    return { personalRedactionRules: stored.personalRedactionRules ?? [] }
  }
  public async save(
    user: User,
    settings: UserSettingsDto,
  ): Promise<UserSettingsDto> {
    await validateOrReject(settings)
    await this.repository.getRepo().update(user.id, {
      personalRedactionRules: settings.personalRedactionRules.map(
        ({ field, match, pattern }) => ({ field, match, pattern }),
      ),
    })
    return this.read(user)
  }
}

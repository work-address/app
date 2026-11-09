import { inject, injectable } from 'inversify'

import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { UserRepository } from '@/repository/user-repository'
import { AccountAddress } from '@/service/account-address'
import { runPromise } from '@/service/effect-bridge'

export interface ICollaborator {
  /** As the project's list holds it. */
  address: string
  role: 'worker' | 'viewer'
  /** The account the address names; none until someone signs in with it. */
  account: User | undefined
}

/**
 * The people on projects' lists and the account each one names. A list holds
 * addresses, and an address can sit there before its account exists or in
 * another casing than the account's, so everything that shows who is listed
 * reads it here and gets the account signing in with that address reaches.
 */
@injectable()
export class Collaborators {
  @inject('UserRepository') private users: UserRepository

  /** Each project's people by project id: workers, then viewers, as listed. */
  public async of(projects: Project[]): Promise<Map<string, ICollaborator[]>> {
    const lists = projects.map((project) => ({
      id: project.id,
      listed: [
        ...(project.workerAddresses ?? []).map((address) => ({
          address,
          role: 'worker' as const,
        })),
        ...(project.viewerAddresses ?? []).map((address) => ({
          address,
          role: 'viewer' as const,
        })),
      ],
    }))
    const accounts = await runPromise(
      this.users.accountsByAddress(
        lists.flatMap(({ listed }) => listed.map(({ address }) => address)),
      ),
    )

    return new Map(
      lists.map(({ id, listed }) => [
        id,
        listed.map((person) => ({
          ...person,
          account: accounts.get(AccountAddress.toCanonical(person.address)),
        })),
      ]),
    )
  }
}

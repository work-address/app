import { injectable } from 'inversify'
import { EntityManager } from 'typeorm'

import { getDataSource } from '@/connector/data-source'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { fromPromise, runPromise } from '@/service/effect-bridge'

/**
 * One database transaction around a piece of work that writes more than once.
 *
 * Issuing an invoice inserts the invoice and then links the time it bills;
 * marking one paid flips the time and then the invoice. Run as separate
 * writes, a failure between them left an invoice with no lines, or paid hours
 * under an unpaid invoice - two money records that disagree. Inside `run`
 * either every write lands or none does.
 *
 * `work` receives the transaction's manager and passes it to the
 * repositories it uses (`repository.within(manager)`); a repository used
 * without it runs outside the transaction and is not rolled back with it.
 */
@injectable()
export class UnitOfWork {
  public run<A>(
    work: (manager: EntityManager) => RepoEffect<A>,
  ): RepoEffect<A> {
    // runPromise rethrows the original failure, which is what makes TypeORM
    // roll back - and fromPromise carries that same error out unchanged, so
    // the caller still sees the exception (and its httpCode) that was raised.
    return fromPromise(() =>
      getDataSource().transaction((manager) => runPromise(work(manager))),
    )
  }
}

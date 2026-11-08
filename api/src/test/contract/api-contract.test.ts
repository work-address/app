import { suite, test, timeout } from '@testdeck/mocha'
import axios from 'axios'
import { expect } from 'chai'
import moment from 'moment'

import {
  CONTRACT_SCENARIOS,
  ContractAdapter,
  ContractPerson,
  ContractRequest,
  ContractWorld,
  runScenario,
} from '@work-address/api-contract'

import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { runPromise } from '@/service/effect-bridge'
import { InvoiceManager } from '@/service/invoice-manager'
import { TimeManager } from '@/service/time-manager'

/** The real API over HTTP and Postgres: what the demo's mock is held to. */
@suite()
export class ApiContractTest
  extends BaseControllerTest
  implements ContractAdapter
{
  private people: Record<ContractPerson, User>

  async seed(): Promise<ContractWorld> {
    const projects = this.container.get<ProjectRepository>('ProjectRepository')
    const times = this.container.get<TimeRepository>('TimeRepository')
    const invoices = this.container.get<InvoiceManager>('InvoiceManager')
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const outsider = await this.userFixture.createUser()
    this.people = { owner, worker, viewer, outsider }

    const onProject = async (state: EProjectState) => {
      const project = await this.projectFixture.createPersonal(owner, 60)
      project.state = state
      project.reviewWindowHours = 24
      project.workerAddresses = [worker.address]
      project.viewerAddresses = [viewer.address]
      return runPromise(projects.saveSingle(project))
    }
    const project = await onProject(EProjectState.ACTIVE)
    const closed = await onProject(EProjectState.INACTIVE)

    const entry = async (
      onto: typeof project,
      hoursAgo: number,
      note: string,
      author: User = worker,
    ) => {
      const to = moment.utc().subtract(hoursAgo, 'hours')
      const time = await this.timeFixture.create(
        onto,
        to.clone().subtract(30, 'minutes').toDate(),
        to.toDate(),
        author,
      )
      time.note = note
      return runPromise(times.saveSingle(time))
    }

    const draft = await entry(project, 1, 'draft')
    const old = await entry(project, 72, 'old')
    const loose = await entry(project, 100, 'loose')
    const paid = await entry(project, 101, 'paid')
    paid.isPaid = true
    await runPromise(times.saveSingle(paid))
    const invoiced = await entry(project, 200, 'invoiced')
    const closedEntry = await entry(closed, 2, 'closed')
    const invoice = await runPromise(
      invoices.createFromTimeIds(project, worker, [invoiced.id]),
    )
    const ownerEntry = await entry(project, 5, 'own', owner)
    const settled = await entry(project, 300, 'settled')
    await runPromise(
      invoices.markPaid(
        await runPromise(
          invoices.createFromTimeIds(project, worker, [settled.id]),
        ),
        worker,
      ),
    )
    await runPromise(
      this.container
        .get<TimeManager>('TimeManager')
        .setIsPaidMany([settled.id], false, worker),
    )

    return {
      project: project.id,
      ownerId: owner.id,
      workerId: worker.id,
      draftEntry: draft.id,
      oldEntry: old.id,
      looseEntry: loose.id,
      paidEntry: paid.id,
      billableFromUnix: moment.utc().subtract(102, 'hours').valueOf(),
      billableToUnix: moment.utc().subtract(99, 'hours').valueOf(),
      invoicedEntry: invoiced.id,
      invoice: invoice.id,
      closedEntry: closedEntry.id,
      ownerEntry: ownerEntry.id,
      settledEntry: settled.id,
    }
  }

  async send(person: ContractPerson, request: ContractRequest) {
    const { status, data } = await axios.request({
      baseURL: `${this.url}/api`,
      url: request.path,
      method: request.method,
      data: request.body ?? {},
      validateStatus: () => true,
      headers: {
        Authorization: this.authenticator.getTokens(this.people[person])
          .accessToken,
      },
    })

    return { status, body: data }
  }

  @test()
  @timeout(60000)
  async everyScenario() {
    const failures: string[] = []

    for (const scenario of CONTRACT_SCENARIOS) {
      const failure = await runScenario(this, scenario)
      if (failure) failures.push(`${scenario.name}: ${failure}`)
    }

    expect(failures).to.deep.equal([])
  }
}

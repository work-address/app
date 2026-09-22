import { randomUUID } from 'crypto'
import axios from 'axios'
import { expect } from 'chai'
import { suite, test, timeout } from '@testdeck/mocha'
import * as fs from 'fs'
import * as path from 'path'

import { App } from '@/app/app'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { IConfigParameters } from '@/model/config'
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { IInternalRoute, InternalRoute } from '@/service/internal-route'

type Body = Record<string, unknown>

/**
 * Every internal route is signed with the same key, so the signature has to
 * say which route it was made for. Over HTTP, route by route: a body that
 * route would accept, signed for any other route, is a 401 there - and the
 * same body signed for the route itself is not.
 *
 * Runs with the legacy window closed unless a test opens it, so what is
 * refused is refused by the binding and not by luck with the DTO shapes.
 */
@suite
export class InternalRouteBindingTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected projectRepository: ProjectRepository

  private acceptLegacyBefore: boolean

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  /** The running app's own parameters: the controllers read these. */
  private served(): IConfigParameters {
    return App.container.get('parameters')
  }

  async before() {
    await super.before()

    this.acceptLegacyBefore = this.served().internalSignatureAcceptLegacy
    this.served().internalSignatureAcceptLegacy = false
  }

  async after() {
    this.served().internalSignatureAcceptLegacy = this.acceptLegacyBefore

    await super.after()
  }

  private fixtureBody(file: string): Body {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, '../fixture', file), 'utf8'),
    ).body
  }

  /** A body the route's DTO accepts, stamped afresh so the guard passes. */
  private bodyFor(route: IInternalRoute): Body {
    const stamp = {
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }

    switch (route) {
      case InternalRoute.ENTITLEMENT: {
        return {
          ...this.fixtureBody('entitlement-push.contract.json'),
          ...stamp,
        }
      }
      case InternalRoute.HIRE: {
        return {
          ...this.fixtureBody('marketplace-hire.contract.json'),
          contractId: randomUUID(),
          ...stamp,
        }
      }
      case InternalRoute.END: {
        return { contractId: randomUUID(), ...stamp }
      }
      case InternalRoute.MILESTONE_INVOICE: {
        return {
          contractId: randomUUID(),
          milestoneRef: randomUUID(),
          freelancerId: randomUUID(),
          amountCents: 150000,
          description: 'First milestone',
          workStart: stamp.issuedAt - 7 * 86400,
          workEnd: stamp.issuedAt - 3600,
          ...stamp,
        }
      }
      case InternalRoute.AMEND: {
        return {
          ...this.fixtureBody('marketplace-amend.contract.json'),
          contractId: randomUUID(),
          ...stamp,
        }
      }
      case InternalRoute.PAUSE: {
        return {
          ...this.fixtureBody('marketplace-pause.contract.json'),
          contractId: randomUUID(),
          ...stamp,
        }
      }
      case InternalRoute.SETTLEMENT: {
        return {
          ...this.fixtureBody('marketplace-settlement.contract.json'),
          invoiceId: randomUUID(),
          ...stamp,
        }
      }
      case InternalRoute.SETTLEMENT_REVERSAL: {
        return {
          ...this.fixtureBody('marketplace-settlement-reversal.contract.json'),
          invoiceId: randomUUID(),
          ...stamp,
        }
      }
      default: {
        throw new Error(`No body for ${route.path}`)
      }
    }
  }

  private send(route: IInternalRoute, body: Body, signature: string) {
    return axios.post(`${this.url}${route.path}`, JSON.stringify(body), {
      headers: {
        'Content-Type': 'application/json',
        [route.header]: signature,
      },
      validateStatus: () => true,
    })
  }

  /** `route` takes what was signed for it, and nothing signed for another. */
  private async refusesEveryOtherRoutesSignature(route: IInternalRoute) {
    for (const other of InternalRoute.ALL.filter((known) => known !== route)) {
      const body = this.bodyFor(route)
      const res = await this.send(
        route,
        body,
        this.signature.sign(other, JSON.stringify(body)),
      )

      expect(res.status, `signed for ${other.path}`).to.be.eq(401)
    }

    const own = this.bodyFor(route)
    const accepted = await this.send(
      route,
      own,
      this.signature.sign(route, JSON.stringify(own)),
    )

    // Whatever the route then makes of a contract it has never heard of,
    // it got past the signature and past validation.
    expect(accepted.status, JSON.stringify(accepted.data)).to.not.be.oneOf([
      400, 401,
    ])
  }

  @test
  @timeout(20000)
  async entitlement_refusesABodySignedForAnotherRoute() {
    await this.refusesEveryOtherRoutesSignature(InternalRoute.ENTITLEMENT)
  }

  @test
  @timeout(20000)
  async hire_refusesABodySignedForAnotherRoute() {
    await this.refusesEveryOtherRoutesSignature(InternalRoute.HIRE)
  }

  @test
  @timeout(20000)
  async end_refusesABodySignedForAnotherRoute() {
    await this.refusesEveryOtherRoutesSignature(InternalRoute.END)
  }

  @test
  @timeout(20000)
  async milestoneInvoice_refusesABodySignedForAnotherRoute() {
    await this.refusesEveryOtherRoutesSignature(InternalRoute.MILESTONE_INVOICE)
  }

  @test
  @timeout(20000)
  async amend_refusesABodySignedForAnotherRoute() {
    await this.refusesEveryOtherRoutesSignature(InternalRoute.AMEND)
  }

  @test
  @timeout(20000)
  async pause_refusesABodySignedForAnotherRoute() {
    await this.refusesEveryOtherRoutesSignature(InternalRoute.PAUSE)
  }

  @test
  @timeout(20000)
  async settlement_refusesABodySignedForAnotherRoute() {
    await this.refusesEveryOtherRoutesSignature(InternalRoute.SETTLEMENT)
  }

  @test
  @timeout(20000)
  async settlementReversal_refusesABodySignedForAnotherRoute() {
    await this.refusesEveryOtherRoutesSignature(
      InternalRoute.SETTLEMENT_REVERSAL,
    )
  }

  /**
   * The replay this route's own header closes: a settlement push captured on
   * its way to the app names every field a reversal of it does, but signed
   * for the push it can never be sent here to undo the payment it recorded.
   */
  @test
  @timeout(20000)
  async aCapturedSettlementPush_cannotBeReplayedAsItsReversal() {
    const push = this.bodyFor(InternalRoute.SETTLEMENT)
    const captured = this.signature.sign(
      InternalRoute.SETTLEMENT,
      JSON.stringify(push),
    )

    const replayed = await this.send(
      InternalRoute.SETTLEMENT_REVERSAL,
      push,
      captured,
    )

    expect(replayed.status).to.be.eq(401)
  }

  /** A project opened by a real hire, so there is something to close. */
  private async hired(): Promise<{ contractId: string; projectId: string }> {
    const client = await this.userFixture.createUser()
    const body: Body = {
      ...this.bodyFor(InternalRoute.HIRE),
      clientId: client.id,
      freelancerId: randomUUID(),
    }
    const res = await this.send(
      InternalRoute.HIRE,
      body,
      this.signature.sign(InternalRoute.HIRE, JSON.stringify(body)),
    )

    expect(res.status, JSON.stringify(res.data)).to.be.eq(200)

    return {
      contractId: body.contractId as string,
      projectId: res.data.projectId,
    }
  }

  private async stateOf(projectId: string): Promise<EProjectState> {
    const project = await this.projectRepository
      .getRepo()
      .findOneOrFail({ where: { id: projectId } })

    return project.state
  }

  /**
   * The replay the binding closes. A resume is a pause body, and a pause
   * body parses as an end - the end DTO keeps the keys it does not declare,
   * so it re-serialises to the bytes that were signed. A resume captured
   * before it arrived, sent on as an end, used to close the project for
   * good; signed for the pause route, it is refused on the end route.
   */
  @test
  @timeout(20000)
  async aCapturedResume_cannotBeReplayedAsAnEnd() {
    const { contractId, projectId } = await this.hired()
    const resume = {
      contractId,
      paused: false,
      sequence: 1,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }
    const captured = this.signature.sign(
      InternalRoute.PAUSE,
      JSON.stringify(resume),
    )

    const replayed = await this.send(InternalRoute.END, resume, captured)

    expect(replayed.status).to.be.eq(401)
    expect(await this.stateOf(projectId)).to.be.eq(EProjectState.ACTIVE)
  }

  /**
   * The same replay in the form callers signed before the binding. It names
   * no route, so it is only as safe as the window is short: refused with
   * the window closed, which is what closing it buys.
   */
  @test
  @timeout(20000)
  async aLegacySignature_isRefusedOnceTheWindowIsClosed() {
    const { contractId, projectId } = await this.hired()
    const resume = {
      contractId,
      paused: false,
      sequence: 1,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }
    const legacy = this.signature.signLegacy(JSON.stringify(resume))

    const asPause = await this.send(InternalRoute.PAUSE, resume, legacy)
    const asEnd = await this.send(InternalRoute.END, resume, legacy)

    expect(asPause.status).to.be.eq(401)
    expect(asEnd.status).to.be.eq(401)
    expect(await this.stateOf(projectId)).to.be.eq(EProjectState.ACTIVE)
  }

  /**
   * The window itself: a marketplace one release behind still signs the
   * body alone, and while the switch is on its calls go through.
   */
  @test
  @timeout(20000)
  async aLegacySignature_isAcceptedWhileTheWindowIsOpen() {
    this.served().internalSignatureAcceptLegacy = true

    const { contractId, projectId } = await this.hired()
    const end = {
      contractId,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }
    const res = await this.send(
      InternalRoute.END,
      end,
      this.signature.signLegacy(JSON.stringify(end)),
    )

    expect(res.status, JSON.stringify(res.data)).to.be.eq(200)
    expect(res.data).to.deep.eq({ projectId, closed: true })
    expect(await this.stateOf(projectId)).to.be.eq(EProjectState.INACTIVE)
  }
}

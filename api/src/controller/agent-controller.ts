import {
  Authorized,
  Body,
  Delete,
  Get,
  HeaderParam,
  HttpCode,
  OnUndefined,
  JsonController,
  Param,
  Post,
  Put,
  Res,
} from 'routing-controllers'
import express from 'express'
import { OpenAPI } from 'routing-controllers-openapi'
import { isUUID } from 'class-validator'
import { BadRequestError } from 'routing-controllers'
import { App } from '@/app/app'
import { CurrentUser } from '@/decorator/current-user'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import {
  AgentCredentialDto,
  AgentDto,
  AgentIdDto,
  AgentRateDto,
  AgentSearchDto,
} from '@/model/dto/agent'
import { AgentRepository } from '@/repository/agent-repository'
import { AgentRunRecord } from '@/service/agent-run-record'

const strict = { validate: { whitelist: true, forbidNonWhitelisted: true } }

@JsonController()
export class AgentController {
  private agents = App.container.get<AgentRepository>('AgentRepository')
  private runs = App.container.get<AgentRunRecord>('AgentRunRecord')

  @Authorized([EUserRole.ROLE_USER])
  @Get('/agents')
  list(@CurrentUser() user: User) {
    return this.agents.list(user)
  }

  @Authorized([EUserRole.ROLE_USER])
  @Post('/agents')
  @HttpCode(201)
  create(@CurrentUser() user: User, @Body(strict) data: AgentDto) {
    return this.agents.save(user, data, true)
  }

  @Authorized([EUserRole.ROLE_USER])
  @Put('/agents')
  edit(@CurrentUser() user: User, @Body(strict) data: AgentDto) {
    return this.agents.save(user, data, false)
  }

  @Authorized([EUserRole.ROLE_USER])
  @Delete('/agents')
  @HttpCode(204)
  @OnUndefined(204)
  remove(@CurrentUser() user: User, @Body(strict) data: AgentIdDto) {
    return this.agents.remove(user, data.id)
  }

  @Authorized([EUserRole.ROLE_USER])
  @Get('/project/:id/agents')
  attachments(@CurrentUser() user: User, @Param('id') id: string) {
    return this.agents.attachments(user, AgentController.uuid(id))
  }

  @Authorized([EUserRole.ROLE_USER])
  @Put('/project/:id/agents/:agentId')
  attach(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('agentId') agentId: string,
    @Body(strict) data: AgentRateDto,
  ) {
    return this.agents.attach(
      user,
      AgentController.uuid(id),
      AgentController.uuid(agentId),
      data.rateHourCents,
    )
  }

  @Authorized([EUserRole.ROLE_USER])
  @Delete('/project/:id/agents/:agentId')
  detach(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('agentId') agentId: string,
  ) {
    return this.agents.attach(
      user,
      AgentController.uuid(id),
      AgentController.uuid(agentId),
      null,
    )
  }

  @Authorized([EUserRole.ROLE_USER])
  @Post('/agent-tracking/credentials')
  @HttpCode(201)
  issue(@CurrentUser() user: User, @Body(strict) data: AgentCredentialDto) {
    return this.agents.issue(user, data)
  }

  @Authorized([EUserRole.ROLE_USER])
  @Get('/agent-tracking/credentials')
  credentials(@CurrentUser() user: User) {
    return this.agents.credentials(user)
  }

  @Authorized([EUserRole.ROLE_USER])
  @Delete('/agent-tracking/credentials/:id')
  @HttpCode(204)
  @OnUndefined(204)
  revoke(@CurrentUser() user: User, @Param('id') id: string) {
    return this.agents.revoke(user, AgentController.uuid(id))
  }

  @OpenAPI({
    security: [{ agentCredential: [] }],
    summary:
      'Durably ingest strictly validated agent events with a write-only collector credential',
  })
  @Post('/agent-tracking/events')
  @HttpCode(200)
  async ingest(
    @HeaderParam('authorization') authorization: string,
    @Body() body: unknown,
    @Res() res: express.Response,
  ) {
    try {
      return await this.runs.ingest(authorization, body)
    } catch (error) {
      if ((error as { httpCode?: number }).httpCode === 429)
        res.setHeader('Retry-After', '20')
      throw error
    }
  }

  @Authorized([EUserRole.ROLE_USER])
  @Post('/agent-tracking/search')
  @HttpCode(200)
  search(@CurrentUser() user: User, @Body(strict) query: AgentSearchDto) {
    return this.runs.search(user, query)
  }

  @Authorized([EUserRole.ROLE_USER])
  @Get('/agent-tracking/status')
  status(@CurrentUser() user: User) {
    return this.runs.status(user)
  }

  private static uuid(value: string): string {
    if (!isUUID(value)) throw new BadRequestError('INVALID_ID')
    return value
  }
}

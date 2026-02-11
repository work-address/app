import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Post,
  Put,
  Req,
  Res,
  ResponseClassTransformOptions,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import express from 'express';
import {App} from '../app/App';
import {User} from '../entity/User';
import {Activity} from '../entity/Activity';
import {EntityFromParam} from '../decorator/EntityFromParam';
import {ExtendedResponseSchema} from '../decorator/ExtendedResponseSchema';
import {EUserRole} from '../interface/EUserRole';
import {AbstractController} from './AbstractController';
import {CurrentUser} from '../decorator/CurrentUser';
import {ActivityRepository} from '../repository/ActivityRepository';
import {ActivitySearchDto} from '../validator/dto/ActivitySearchDto';
import {ActivityManager} from '../service/ActivityManager';
import {EActivityType} from '../interface/EActivityType';
import {Proposal} from '../entity/Proposal';
import AccessException from '../exception/AccessException';
import {Authenticator} from '../service/auth/Authenticator';

@JsonController('/activity')
export class ActivityController extends AbstractController {
  protected authenticator: Authenticator;
  protected activityManager: ActivityManager;
  protected activityRepository: ActivityRepository;

  constructor() {
    super();

    this.authenticator = App.container.get('Authenticator');
    this.activityManager = App.container.get('ActivityManager');
    this.activityRepository = App.container.get('ActivityRepository');
  }

  @OpenAPI({
    summary: 'Search projects as public',
  })
  @HttpCode(200)
  @Post('/search')
  @ExtendedResponseSchema(Activity, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public search(@Body() search: ActivitySearchDto) {
    return this.activityRepository.findAndCount(search);
  }

  @OpenAPI({
    summary: 'Search projects as a freelancer',
    requestBody: {
      content: {
        'application/json': {
          example: {
            filter: {},
            sort: {title: 'ASC'},
            page: 0,
          },
          schema: {
            properties: {},
          },
        },
      },
      required: false,
    },
  })
  @Post('/search/freelancer')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ExtendedResponseSchema(Activity, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public searchFreelancer(@CurrentUser() currentUser: User, @Body() search: ActivitySearchDto) {
    return this.activityRepository.findAndCountFreelancer(search, currentUser);
  }

  @OpenAPI({
    summary: 'Search projects as a business',
    requestBody: {
      content: {
        'application/json': {
          example: {
            filter: {},
            sort: {title: 'ASC'},
            page: 0,
          },
          schema: {
            properties: {},
          },
        },
      },
      required: false,
    },
  })
  @Post('/search/business')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ExtendedResponseSchema(Activity, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public searchBusiness(@CurrentUser() currentUser: User, @Body() search: ActivitySearchDto) {
    return this.activityRepository.findAndCountBusiness(search, currentUser);
  }

  @OpenAPI({
    summary: 'Accept proposal',
  })
  @Post('/:id/accept/:proposalId')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ResponseClassTransformOptions({groups: ['search']})
  public async acceptProposal(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id') activity: Activity,
    @EntityFromParam('proposalId') proposal: Proposal
  ) {
    if (currentUser.id !== activity.user.id) {
      throw new AccessException();
    }

    await this.activityManager.acceptProposal(activity, proposal);

    return {};
  }

  @OpenAPI({
    summary: 'Project create',
  })
  @Post()
  @HttpCode(201)
  @Authorized([EUserRole.ROLE_USER])
  public async create(
    @CurrentUser() currentUser: User,
    @Body({validate: {groups: ['create']}, transform: {groups: ['create']}}) data: Activity,
    @Res() res: any
  ) {
    data.user = currentUser;

    const isValidType = [
      EActivityType.HOURLY,
      EActivityType.FIXED,
      EActivityType.PERSONAL,
    ].includes(data.type);

    if (!isValidType) {
      throw new Error(`The wrong type ${data.type} provided`);
    }

    const activity = await this.activityManager.save(data);

    res.status(201);
    res.location(`/api/activity/${activity.id}`);

    return {};
  }

  @OpenAPI({
    summary: 'Retrieve full data of a project',
  })
  @HttpCode(200)
  @Get('/:id')
  @ExtendedResponseSchema(Activity)
  @ResponseClassTransformOptions({groups: ['search']})
  public async read(
    @EntityFromParam('id') activity: Activity,
    @Req() req: express.Request
  ): Promise<Activity | undefined> {
    const token = req.headers['authorization'] as string;
    const user = await this.authenticator.getUserFromJwtToken(token);

    return await this.activityManager.findActivityCheckAccess(activity, user);
  }

  @OpenAPI({
    summary: 'Project edit',
  })
  @Put('/:id')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public async edit(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id') activity: Activity,
    @Body({validate: {groups: ['edit']}, transform: {groups: ['edit']}}) data: Activity
  ) {
    if (currentUser.id !== activity.user.id) {
      throw new AccessException();
    }

    await this.activityManager.editAndSave(activity, data);

    return {};
  }

  @OpenAPI({
    summary: 'Close project without removing it',
  })
  @Post('/:id/close')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ResponseClassTransformOptions({groups: ['search']})
  public async close(@EntityFromParam('id') activity: Activity, @CurrentUser() currentUser: User) {
    if (currentUser.id !== activity.user.id) {
      throw new AccessException();
    }

    await this.activityManager.close(activity);

    return {};
  }

  @OpenAPI({
    summary: 'Project delete',
  })
  @Delete('/:id')
  @HttpCode(200)
  public async delete(@CurrentUser() currentUser: User, @EntityFromParam('id') activity: Activity) {
    await this.activityRepository.softDelete({
      id: activity.id,
      user: currentUser,
    });

    return {};
  }
}

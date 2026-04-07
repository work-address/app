import {
  Body,
  Delete,
  HttpCode,
  JsonController,
  Post,
  Put,
  Res,
  ResponseClassTransformOptions,
} from 'routing-controllers';
import faker from 'faker';
import {OpenAPI} from 'routing-controllers-openapi';

import {App} from '../app/App';
import {User} from '../entity/User';
import {AbstractController} from './AbstractController';
import {CurrentUser} from '../decorator/CurrentUser';
import {ProposalManager} from '../service/ProposalManager';
import {ProposalRepository} from '../repository/ProposalRepository';
import {Proposal} from '../entity/Proposal';
import {ProposalSearchDto} from '../validator/dto/ProposalSearchDto';
import {EntityFromParam} from '../decorator/EntityFromParam';
import {ActivityRepository} from '../repository/ActivityRepository';
import AccessException from '../exception/AccessException';
import {OpenApi} from '../service/OpenApi';

@JsonController('/proposal')
export class ProposalController extends AbstractController {
  protected proposalManager: ProposalManager;
  protected proposalRepository: ProposalRepository;
  protected activityRepository: ActivityRepository;

  constructor() {
    super();

    this.proposalManager = App.container.get('ProposalManager');
    this.proposalRepository = App.container.get('ProposalRepository');
    this.activityRepository = App.container.get('ActivityRepository');
  }

  @OpenAPI({
    summary: 'Search proposals (business perspective)',
    description: 'Paged list for the current user as business; `filter.activityId` limits by activity.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {activityId: faker.datatype.uuid()},
            sort: {createdAt: 'DESC'},
            page: 0,
          },
        },
      },
    },
    responses: {
      200: OpenApi.paginatedTupleResponse,
    },
  })
  @Post('/search/business')
  @ResponseClassTransformOptions({groups: ['search']})
  public searchBusiness(@CurrentUser() currentUser: User, @Body() search: ProposalSearchDto) {
    return this.proposalRepository.findAndCountBusiness(search, currentUser);
  }

  @OpenAPI({
    summary: 'Search proposals (freelancer perspective)',
    description: 'Paged list for the current user as freelancer; `filter.activityId` limits by activity.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {activityId: faker.datatype.uuid()},
            sort: {createdAt: 'DESC'},
            page: 0,
          },
        },
      },
    },
    responses: {
      200: OpenApi.paginatedTupleResponse,
    },
  })
  @Post('/search/freelancer')
  @ResponseClassTransformOptions({groups: ['search']})
  public search(@CurrentUser() currentUser: User, @Body() search: ProposalSearchDto) {
    return this.proposalRepository.findAndCountFreelancer(search, currentUser);
  }

  @OpenAPI({
    summary: 'Create proposal',
    description:
      'Body is validated with Proposal `create` groups. `user` is taken from the JWT; include `text`, `rate`, and `activity` (e.g. `{ id }`).',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          example: {
            text: 'I can deliver in two weeks.',
            rate: 120,
            activity: {id: faker.datatype.uuid()},
          },
          schema: {
            type: 'object',
            required: ['text', 'rate', 'activity'],
            properties: {
              text: {type: 'string'},
              rate: {type: 'number'},
              activity: {
                type: 'object',
                required: ['id'],
                properties: {id: {type: 'string', format: 'uuid'}},
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created. Empty JSON body; use `Location` for the new resource URL.',
        headers: {
          Location: {
            description: 'URI of the created proposal (e.g. `/api/proposal/{id}`)',
            schema: {type: 'string'},
          },
        },
        content: {
          'application/json': {
            schema: {type: 'object', properties: {}},
          },
        },
      },
    },
  })
  @Post()
  @HttpCode(201)
  public async create(
    @CurrentUser() currentUser: User,
    @Body({validate: {groups: ['create']}, transform: {groups: ['create']}}) data: Proposal,
    @Res() res: any
  ) {
    data.user = currentUser;

    const proposal = await this.proposalManager.save(data);

    res.status(201);
    res.location(`/api/proposal/${proposal.id}`);

    return {};
  }

  @OpenAPI({
    summary: 'Update own proposal',
    description:
      'Only the proposal owner may edit. Fails if the proposal was already accepted for an activity.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              text: {type: 'string'},
              rate: {type: 'number'},
            },
          },
          example: {text: 'Updated scope and timeline.', rate: 130},
        },
      },
    },
    responses: {
      200: OpenApi.emptyObjectResponse,
    },
  })
  @Put('/:id')
  @HttpCode(200)
  public async edit(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id', null, {user: true, activity: true}) proposal: Proposal,
    @Body({validate: {groups: ['edit']}, transform: {groups: ['edit']}}) data: Proposal
  ) {
    if (proposal.user.id !== currentUser.id) {
      throw new AccessException();
    }

    await this.proposalManager.edit(proposal, data);

    return {};
  }

  @OpenAPI({
    summary: 'Delete own proposal',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
      },
    ],
    responses: {
      200: OpenApi.emptyObjectResponse,
    },
  })
  @Delete('/:id')
  @HttpCode(200)
  public async delete(@CurrentUser() currentUser: User, @EntityFromParam('id') proposal: Proposal) {
    await this.proposalRepository.delete({
      id: proposal.id,
      user: currentUser,
    });

    return {};
  }
}

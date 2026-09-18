import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { helpControllerSwagger } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'

@suite()
export class HelpControllerTest extends BaseControllerTest {
  @test()
  async openApi_returnsSpecificationDocument() {
    const client = this.apiClient()
    const res = await helpControllerSwagger({
      client,
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.an('object')
    expect(res.data).to.have.property('openapi')
    expect(res.data).to.have.property('paths')
    expect(res.data).to.have.property('components')

    const spec = res.data as {
      paths: Record<
        string,
        {
          post?: {
            responses?: Record<string, Record<string, unknown>>
          }
          get?: { responses?: Record<string, Record<string, unknown>> }
          put?: { responses?: Record<string, Record<string, unknown>> }
          delete?: { responses?: Record<string, Record<string, unknown>> }
        }
      >
    }

    expect(
      spec.paths['/api/auth/eth']?.post?.responses?.['200'],
    ).to.not.have.property('content')
    expect(
      spec.paths['/api/project']?.post?.responses?.['201'],
    ).to.not.have.property('content')
    expect(
      spec.paths['/api/user']?.put?.responses?.['204'],
    ).to.not.have.property('content')

    const userReadGet = spec.paths['/api/user/{address}/address']?.get as
      | {
          responses?: Record<
            string,
            {
              content?: {
                [contentType: string]: {
                  schema?: {
                    $ref?: string
                    properties?: Record<
                      string,
                      { type?: string; example?: string }
                    >
                  }
                }
              }
              description?: string
            }
          >
        }
      | undefined

    expect(userReadGet?.responses?.['200']).to.exist
    expect(
      userReadGet?.responses?.['200']?.content?.['application/json']?.schema
        ?.$ref,
    ).to.be.equal('#/components/schemas/User_public')

    // The generated client types the public read from these schemas, so they
    // are what keeps a consumer from reading a contact detail off a profile.
    const schemas = (
      res.data as {
        components?: {
          schemas?: Record<string, { properties?: Record<string, unknown> }>
        }
      }
    ).components?.schemas
    expect(Object.keys(schemas?.User_public?.properties ?? {})).to.have.members(
      [
        'address',
        'name',
        'title',
        'company',
        'bio',
        'rate',
        'skills',
        'facebook',
        'linkedIn',
        'twitter',
        'instagram',
        'youtube',
        'telegram',
        'tz',
        'city',
        'country',
      ],
    )
    for (const key of ['email', 'phone', 'whatsapp', 'roles', 'premium']) {
      expect(schemas?.User_search?.properties, key).to.not.have.property(key)
    }

    expect(userReadGet?.responses?.['404']).to.exist
    expect(userReadGet?.responses?.['404']?.description).to.be.equal(
      'User does not exist',
    )
    expect(
      userReadGet?.responses?.['404']?.content?.['application/json']?.schema
        ?.properties?.name?.example,
    ).to.be.equal('NotFoundError')
    expect(
      userReadGet?.responses?.['404']?.content?.['application/json']?.schema
        ?.properties?.message?.example,
    ).to.be.equal('User does not exist')

    const projectReadGet = spec.paths['/api/project/{id}']?.get as
      | {
          responses?: Record<
            string,
            {
              content?: {
                [contentType: string]: {
                  schema?: {
                    $ref?: string
                    properties?: Record<
                      string,
                      { type?: string; example?: string }
                    >
                  }
                }
              }
              description?: string
            }
          >
        }
      | undefined

    expect(projectReadGet?.responses?.['200']).to.exist
    expect(
      projectReadGet?.responses?.['200']?.content?.['application/json']?.schema
        ?.$ref,
    ).to.be.equal('#/components/schemas/Project_search')
    const projectSearchSchema = (
      res.data as {
        components?: {
          schemas?: Record<
            string,
            {
              properties?: Record<
                string,
                {
                  $ref?: string
                  type?: string
                  items?: { $ref?: string }
                }
              >
            }
          >
        }
      }
    ).components?.schemas?.Project_search
    expect(projectSearchSchema?.properties?.user?.$ref).to.be.equal(
      '#/components/schemas/User_search',
    )
    expect(projectSearchSchema?.properties?.workerAddresses?.type).to.be.equal(
      'array',
    )
    expect(projectSearchSchema?.properties?.viewerAddresses?.type).to.be.equal(
      'array',
    )
    expect(projectSearchSchema?.properties?.workers?.items?.$ref).to.be.equal(
      '#/components/schemas/User_search',
    )
    expect(projectSearchSchema?.properties?.viewers?.items?.$ref).to.be.equal(
      '#/components/schemas/User_search',
    )

    const projectEditSchema = (
      res.data as {
        components?: {
          schemas?: Record<
            string,
            { properties?: Record<string, { type?: string }> }
          >
        }
      }
    ).components?.schemas?.Project_edit
    expect(projectEditSchema?.properties?.workerAddresses?.type).to.be.equal(
      'array',
    )
    expect(projectEditSchema?.properties?.viewerAddresses?.type).to.be.equal(
      'array',
    )

    const projectCreateSchema = (
      res.data as {
        components?: {
          schemas?: Record<
            string,
            { properties?: Record<string, { type?: string }> }
          >
        }
      }
    ).components?.schemas?.Project_create
    expect(projectCreateSchema?.properties?.workerAddresses?.type).to.be.equal(
      'array',
    )
    expect(projectCreateSchema?.properties?.viewerAddresses?.type).to.be.equal(
      'array',
    )

    expect(projectReadGet?.responses?.['404']).to.exist
    expect(projectReadGet?.responses?.['404']?.description).to.be.equal(
      'Project does not exist',
    )

    const timeReadGet = spec.paths['/api/time/{id}']?.get as
      | {
          responses?: Record<
            string,
            {
              content?: {
                [contentType: string]: {
                  schema?: {
                    $ref?: string
                    properties?: Record<
                      string,
                      { type?: string; example?: string }
                    >
                  }
                }
              }
              description?: string
            }
          >
        }
      | undefined

    expect(timeReadGet?.responses?.['200']).to.exist
    expect(
      timeReadGet?.responses?.['200']?.content?.['application/json']?.schema
        ?.$ref,
    ).to.be.equal('#/components/schemas/Time_search')
    expect(timeReadGet?.responses?.['404']).to.exist
    expect(timeReadGet?.responses?.['404']?.description).to.be.equal(
      'Time does not exist',
    )

    const invoiceSearchSchema = (
      res.data as {
        components?: {
          schemas?: Record<
            string,
            { properties?: Record<string, { $ref?: string }> }
          >
        }
      }
    ).components?.schemas?.Invoice_search
    expect(invoiceSearchSchema?.properties?.project?.$ref).to.be.equal(
      '#/components/schemas/Project_search',
    )
  }

  /**
   * The entitlement push and the marketplace hire answer the web service,
   * which signs them with a shared secret. They are no browser's business,
   * so the spec the browser clients and the docs are built from leaves them,
   * and the request bodies only they take, out.
   */
  @test()
  async openApi_leavesServiceToServiceRoutesOut() {
    const res = await helpControllerSwagger({
      client: this.apiClient(),
      throwOnError: true,
    })
    const spec = res.data as {
      paths: Record<string, unknown>
      components: { schemas: Record<string, unknown> }
    }

    expect(
      Object.keys(spec.paths).filter((path) =>
        path.startsWith('/api/internal'),
      ),
    ).to.deep.equal([])
    expect(spec.components.schemas).to.not.have.any.keys(
      'EntitlementPushDto',
      'MarketplaceHireDto',
    )
    expect(spec.paths).to.have.property('/api/project')
    expect(spec.components.schemas).to.have.property('Project_search')
  }
}

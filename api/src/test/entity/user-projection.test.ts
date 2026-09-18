import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { instanceToPlain } from 'class-transformer'

import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'

const PUBLIC_KEYS = [
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
]

const HOLDER_ONLY_KEYS = ['email', 'phone', 'roles', 'premium']

/**
 * The User projections, checked at the serializer rather than per endpoint.
 * Every route that nests a person - a project's owner, workers and viewers,
 * an invoice's issuer, a time entry's author - renders them with `search`,
 * so this is the one place the rule is proven for all of them at once.
 */
@suite()
export class UserProjectionTest {
  /** Every field filled, so an absent key is a decision, not an empty one. */
  private user(): User {
    return Object.assign(new User(), {
      id: '6f1c1d4e-3f7a-4a38-9c55-2b8a4f2f0a11',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      updatedAt: new Date('2026-01-03T03:04:05.000Z'),
      address: '0x1111111111111111111111111111111111111111',
      email: 'ada@example.com',
      phone: '+12345678901',
      whatsapp: '+12345678902',
      name: 'Ada',
      title: 'Engineer',
      company: 'Analytical',
      bio: 'Notes on the engine.',
      rate: 50,
      skills: 'maths,engines',
      facebook: 'https://facebook.com/ada',
      linkedIn: 'https://linkedin.com/in/ada',
      twitter: '@ada',
      instagram: '@ada',
      youtube: 'https://youtube.com/@ada',
      telegram: '@ada',
      tz: 'Europe/London',
      city: 'London',
      country: 'GB',
      roles: [EUserRole.ROLE_USER],
      premium: true,
    })
  }

  @test()
  public_isTheProfilePageAndNothingElse() {
    const plain = instanceToPlain(this.user(), { groups: ['public'] })

    expect(Object.keys(plain)).to.have.members(PUBLIC_KEYS)
  }

  @test()
  search_addsOnlyTheIdAndTimestamps() {
    const plain = instanceToPlain(this.user(), { groups: ['search'] })

    expect(Object.keys(plain)).to.have.members([
      ...PUBLIC_KEYS,
      'id',
      'createdAt',
      'updatedAt',
    ])
  }

  @test()
  me_addsTheHoldersOwnDetailsButNotWhatsapp() {
    const plain = instanceToPlain(this.user(), { groups: ['search', 'me'] })

    expect(plain).to.include({
      email: 'ada@example.com',
      phone: '+12345678901',
      premium: true,
    })
    expect(plain.roles).to.deep.equal([EUserRole.ROLE_USER])
    expect(plain).to.not.have.property('whatsapp')
  }

  @test()
  nestedPeople_carryNoHolderOnlyDetails() {
    const project = Object.assign(new Project(), {
      user: this.user(),
      workers: [this.user()],
      viewers: [this.user()],
    })
    const invoice = Object.assign(new Invoice(), { user: this.user() })
    const time = Object.assign(new Time(), { user: this.user() })

    const projectPlain = instanceToPlain(project, { groups: ['search'] })
    const people = [
      projectPlain.user,
      projectPlain.workers[0],
      projectPlain.viewers[0],
      instanceToPlain(invoice, { groups: ['search'] }).user,
      instanceToPlain(time, { groups: ['search'] }).user,
    ]

    for (const person of people) {
      expect(person.address).to.equal(this.user().address)
      for (const key of [...HOLDER_ONLY_KEYS, 'whatsapp']) {
        expect(person, key).to.not.have.property(key)
      }
    }
  }
}

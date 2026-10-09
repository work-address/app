import 'reflect-metadata'

import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import { ProjectSearchDto } from '@/model/dto/project'

describe('ProjectSearchDto id sort', () => {
  for (const direction of ['ASC', 'DESC']) {
    it(`accepts ${direction} for unique project pagination`, () => {
      const dto = plainToInstance(ProjectSearchDto, {
        filter: {},
        sort: { id: direction },
        page: 0,
      })
      expect(dto.sort.id).to.equal(direction)
      expect(validateSync(dto)).to.have.length(0)
    })
  }

  it('rejects an invalid id sort direction', () => {
    const dto = plainToInstance(ProjectSearchDto, {
      filter: {},
      sort: { id: 'INVALID' },
      page: 0,
    })
    const errors = validateSync(dto)
    expect(
      errors.some(
        (error) =>
          error.property === 'sort' &&
          error.children?.some((child) => child.property === 'id'),
      ),
    ).to.equal(true)
  })
})

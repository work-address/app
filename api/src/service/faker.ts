import { faker, type Faker as FakerJs } from '@faker-js/faker'
import { injectable } from 'inversify'

@injectable()
export class Faker {
  public email(): string {
    return `${this.uuid()}${faker.internet.email()}`
  }

  public phone(): string {
    return `+1234353${faker.string.numeric(7)}`
  }

  public userStoreName(): string {
    return `${faker.lorem.word({
      length: 8,
    })}${faker.number.int()}${faker.number.int()}`
  }

  public userHostName(): string {
    return `${faker.lorem.word({
      length: 8,
    })}${faker.number.int()}${faker.number.int()}`
  }

  private uuid() {
    return faker.string.uuid().replace('-', '')
  }

  public getFaker(): FakerJs {
    return faker
  }
}

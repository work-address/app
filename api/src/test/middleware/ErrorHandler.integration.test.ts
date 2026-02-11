import {suite, test} from '@testdeck/mocha';
import * as httpMocks from 'node-mocks-http';
import {expect} from 'chai';
import faker from 'faker';
import {Action} from 'routing-controllers';

import {ErrorHandler} from '../../middleware/ErrorHandler';

@suite()
export class ErrorHandlerTest {
  @test()
  errorHandler_serverInternalError() {
    const action: Action = {
      request: httpMocks.createRequest(),
      response: httpMocks.createResponse(),
    };
    const error = new Error(faker.lorem.sentence());

    const errorHandler = new ErrorHandler();

    errorHandler.error(error, action.request, action.response, err => {
      console.log('err', err);
    });

    expect(action.response.statusCode).to.be.equal(500);
    expect(action.response._getData()).to.be.eql({
      message: error.message,
      name: error.name,
    });
  }

  @test()
  errorHandlerStructure() {
    const action: Action = {
      request: httpMocks.createRequest(),
      response: httpMocks.createResponse(),
    };
    const error = {
      message: faker.lorem.sentence(),
      name: faker.name.firstName(),
      errors: [faker.name.firstName(), faker.name.firstName()],
      [faker.name.firstName()]: faker.name.firstName(),
      httpCode: 400,
    };

    const errorHandler = new ErrorHandler();
    errorHandler.error(error, action.request, action.response, err => {
      console.log('err', err);
    });

    expect(action.response.statusCode).to.be.equal(error.httpCode);
    expect(action.response._getData()).to.be.eql({
      message: error.message,
      name: error.name,
      errors: error.errors,
    });
  }
}

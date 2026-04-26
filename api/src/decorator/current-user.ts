import {createParamDecorator} from 'routing-controllers';
import {AppContainer} from '../app/app-container';
import {Authenticator} from '../service/auth/authenticator';

export function CurrentUser() {
  return createParamDecorator({
    value: action => {
      if (action.request.user) {
        return action.request.user;
      }

      const authenticator: Authenticator = AppContainer.getContainer().get('Authenticator');
      const token = action.request.headers['authorization'];

      return authenticator.getUserFromJwtTokenOrThrowException(token);
    },
  });
}

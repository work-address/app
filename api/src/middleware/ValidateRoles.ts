import {Action} from 'routing-controllers';

import {Authenticator} from '../service/auth/Authenticator';
import {AppContainer} from '../app/AppContainer';

export const ValidateRoles = async (action: Action, roles: string[] = []) => {
  console;
  const authenticator: Authenticator = AppContainer.getContainer().get('Authenticator');
  const token = action.request.headers.authorization as string;
  const user = await authenticator.getUserFromJwtTokenOrThrowException(token);

  let isValid = false;

  if (roles.length === 0) {
    isValid = true;
  }

  roles.forEach((r: any) => {
    if (user.roles.indexOf(r) > -1) {
      isValid = true;
    }
  });

  return isValid;
};

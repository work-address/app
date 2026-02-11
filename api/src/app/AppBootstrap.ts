import {App} from './App';
import {AppConfig} from './AppConfig';
import RejectedExecutionException from '../exception/RejectedExecutionException';

export async function createApp() {
  if (AppConfig.isTest()) {
    throw new RejectedExecutionException('Wrong env');
  }

  await Promise.resolve();

  const env = AppConfig.getEnv();
  const parameters = AppConfig.readConfig();

  return new App(parameters, env);
}

export function createAppTest() {
  if (!AppConfig.isTest()) {
    throw new RejectedExecutionException('Wrong env');
  }

  const parameters = AppConfig.readConfig();
  return new App(parameters, 'test');
}

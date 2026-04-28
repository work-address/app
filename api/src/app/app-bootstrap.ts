import { App } from '@/app/app'
import { AppConfig } from '@/app/app-config'
import RejectedExecutionException from '@/exception/rejected-execution-exception'

export async function createApp() {
  if (AppConfig.isTest()) {
    throw new RejectedExecutionException('Wrong env')
  }

  await Promise.resolve()

  const env = AppConfig.getEnv()
  const parameters = AppConfig.readConfig()

  return new App(parameters, env)
}

export function createAppTest() {
  if (!AppConfig.isTest()) {
    throw new RejectedExecutionException('Wrong env')
  }

  const parameters = AppConfig.readConfig()
  return new App(parameters, 'test')
}

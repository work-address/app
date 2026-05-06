import { inject, injectable } from 'inversify'
import 'reflect-metadata'

import { IConfigParameters } from '@/model/config'

@injectable()
export class Mailer {
  @inject('env')
  protected env: string
  @inject('parameters')
  protected parameters: IConfigParameters
}

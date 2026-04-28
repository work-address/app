import { inject, injectable } from 'inversify'
import 'reflect-metadata'

import { IConfigParameters } from '@/interface/config'

@injectable()
export class Mailer {
  @inject('env')
  protected env: string
  @inject('parameters')
  protected parameters: IConfigParameters
}

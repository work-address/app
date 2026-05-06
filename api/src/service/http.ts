import * as _ from 'lodash'
import Axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { injectable } from 'inversify'

@injectable()
export class Http {
  public async request(options: unknown = {}): Promise<AxiosResponse> {
    const config: AxiosRequestConfig = {
      method: 'GET',
    }

    _.assign(config, options as object)

    try {
      return await Axios.request(config)
    } catch (e: unknown) {
      // console.log(e);
      // console.log(e.response.data);
      // console.log(e.response.data.errors);

      throw e
    }
  }
}

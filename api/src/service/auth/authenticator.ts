import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'
import { inject, injectable } from 'inversify'

import { User } from '@/entity/user'
import { Mailer } from '@/service/mailer'

import { IAuthTokenData } from '@/model/auth'
import { UserRepository } from '@/repository/user-repository'
import { EUserRole } from '@/model/user'
import { IAuthTokens } from '@/model/auth'
import { IConfigParameters } from '@/model/config'
import AuthenticationException from '@/exception/authentication-exception'
import { UserManager } from '@/service/user-manager'
import { RedisClient } from '@/service/redis-client'
import { Signer } from '@/service/auth/signer'
import { ProjectManager } from '@/service/project-manager'
import { TimeRepository } from '@/repository/time-repository'
import { TonProofService } from '@/service/auth/ton-proof-service'
import { IAuthTonPayload } from '@/model/auth'

@injectable()
export class Authenticator {
  protected accessTokenExpiresIn: string = '20d'
  protected refreshTokenExpiresIn: string = '180d'

  public static nonceExpiresIn: number = 1000 * 60 * 10 // 10 minutes

  @inject('UserRepository')
  protected userRepository: UserRepository
  @inject('TimeRepository')
  protected timeRepository: TimeRepository
  @inject('ProjectManager')
  protected projectManager: ProjectManager
  @inject('UserManager')
  protected userManager: UserManager
  @inject('Mailer')
  protected mailer: Mailer
  @inject('parameters')
  protected parameters: IConfigParameters
  @inject('Signer')
  protected signer: Signer
  @inject('RedisClient')
  protected redis: RedisClient
  @inject('TonProofService')
  protected tonProofService: TonProofService

  public async getNonce(address: string): Promise<string> {
    const nonce = this.signer.generateNonce()
    const key = `nonce:${address}`

    await this.redis.setWithExpiry(key, nonce, Authenticator.nonceExpiresIn)

    return nonce
  }

  public async getTonNonce(): Promise<string> {
    const nonce = this.signer.generateNonce()
    const key = `nonce:ton:${nonce}`

    await this.redis.setWithExpiry(key, nonce, Authenticator.nonceExpiresIn)

    return nonce
  }

  public async loginEth(
    signature: string,
    address: string,
  ): Promise<IAuthTokens> {
    const key = `nonce:${address}`
    const nonceRaw = await this.redis.get(key)
    if (typeof nonceRaw !== 'string' || !nonceRaw) {
      throw new AuthenticationException('Nonce is not available or expired')
    }
    const nonce = nonceRaw

    const isValid = this.signer.verify(nonce, signature, address)

    if (!isValid) {
      throw new AuthenticationException('Signature is not valid')
    }

    await this.redis.del(key)

    let user = await this.userRepository.findByAddressPublic(address)

    if (!user) {
      user = await this.createUserWithDemoData(address)
    }

    return this.getTokens(user)
  }

  public async loginTon(payload: IAuthTonPayload): Promise<IAuthTokens> {
    const address = payload.address
    const key = `nonce:ton:${payload.proof.payload}`
    const nonce = await this.redis.get(key)

    if (!nonce) {
      throw new AuthenticationException('Nonce is not available or expired')
    }

    const isValid = await this.tonProofService.checkProof(payload)

    if (!isValid) {
      throw new AuthenticationException('Signature is not valid')
    }

    await this.redis.del(key)

    let user = await this.userRepository.findByAddressPublic(address)

    if (!user) {
      user = await this.createUserWithDemoData(address)
    }

    return this.getTokens(user)
  }

  public async loginSolana(
    signature: string,
    address: string,
  ): Promise<IAuthTokens> {
    const key = `nonce:${address}`
    const nonceRaw = await this.redis.get(key)
    if (typeof nonceRaw !== 'string' || !nonceRaw) {
      throw new AuthenticationException('Nonce is not available or expired')
    }
    const nonce = nonceRaw

    const isValid = this.signer.verifySolana(nonce, signature, address)

    if (!isValid) {
      throw new AuthenticationException('Signature is not valid')
    }

    await this.redis.del(key)

    let user = await this.userRepository.findByAddressPublic(address)

    if (!user) {
      user = await this.createUserWithDemoData(address)
    }

    return this.getTokens(user)
  }

  public async getUserFromRefreshToken(token: string): Promise<User> {
    let payload: jwt.JwtPayload & Partial<IAuthTokenData>
    try {
      payload = this.decodeJwtToken(token)
    } catch (e) {
      if (e instanceof AuthenticationException) throw e
      if (e instanceof Error && e.name === 'TokenExpiredError') throw e
      throw new AuthenticationException('Refresh token is not valid')
    }
    const userId = payload.id

    if (!userId) {
      throw new AuthenticationException('Refresh token is not valid')
    }

    try {
      return await this.userRepository.findOneByIdOrFail(userId)
    } catch {
      throw new AuthenticationException('User does not exist')
    }
  }

  public async getUserFromJwtTokenOrThrowException(
    token: string,
  ): Promise<User> {
    const user = await this.getUserFromJwtToken(token)

    if (!user) {
      throw new AuthenticationException('invalid auth token')
    }

    return user
  }

  public async getUserFromJwtToken(token: string): Promise<User | null> {
    try {
      const tokenData = this.decodeJwtToken(token)

      if (tokenData.emailOrPhone) {
        const user = await this.userRepository.findByEmailPhone(
          tokenData.emailOrPhone,
        )

        if (user) {
          return Promise.resolve(user)
        }
      }
      if (tokenData.address) {
        const user = await this.userRepository.findByAddressPublic(
          tokenData.address,
        )

        if (user) {
          return Promise.resolve(user)
        }
      }

      return Promise.resolve(null)
    } catch {
      return Promise.resolve(null)
    }
  }

  public getEmailOrPhoneOrThrowError(token: string): string {
    const tokenData = this.decodeJwtToken(token)

    return tokenData.emailOrPhone as string
  }

  public getJwtIatOrThrowError(token: string): string {
    const tokenData = this.decodeJwtToken(token)

    return String(tokenData.iat)
  }

  public decodeJwtToken(
    token: string,
  ): jwt.JwtPayload & Partial<IAuthTokenData> {
    const payload = jwt.verify(token, this.parameters.jwtSecret)
    if (typeof payload !== 'object' || payload === null) {
      throw new AuthenticationException('Invalid token payload')
    }
    return payload as jwt.JwtPayload & Partial<IAuthTokenData>
  }

  public getTokens(user: User): IAuthTokens {
    const accessToken = this.generateJwtToken(user)
    const refreshToken = this.generateRefreshToken(user)

    return { accessToken, refreshToken }
  }

  public generateRefreshToken(user: User): string {
    return jwt.sign({ id: user.id }, this.parameters.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn,
    })
  }

  public generateJwtToken(user: User): string {
    const data: IAuthTokenData = {
      id: user.id,
      address: user.address,
      emailOrPhone: user.email || user.phone,
    }

    return jwt.sign(data, this.parameters.jwtSecret, {
      expiresIn: this.accessTokenExpiresIn,
    })
  }

  public static hashPassword(plainPassword: string): string {
    return bcrypt.hashSync(plainPassword, 8)
  }

  private async createUserWithDemoData(address: string): Promise<User> {
    const user = new User()
    user.address = address
    user.roles = [EUserRole.ROLE_USER]

    await this.userManager.saveSingle(user)
    await this.projectManager.createDemoData(user)

    return user
  }
}

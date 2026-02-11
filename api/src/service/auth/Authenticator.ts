import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import {inject, injectable} from 'inversify';

import {User} from '../../entity/User';
import {Mailer} from './../Mailer';

import {IAuthTokenData} from '../../interface/IAuthTokenData';
import {UserRepository} from '../../repository/UserRepository';
import {EUserRole} from '../../interface/EUserRole';
import {IAuthTokens} from '../../interface/IAuthTokens';
import {IConfigParameters} from '../../interface/IConfigParameters';
import AuthenticationException from '../../exception/AuthenticationException';
import {UserManager} from './../UserManager';
import {RedisClient} from './../RedisClient';
import {Signer} from './Signer';
import {ActivityManager} from './../ActivityManager';
import {TimeRepository} from '../../repository/TimeRepository';
import {TonProofService} from './TonProofService';
import {IAuthTonPayload} from '../../interface/IAuthTonPayload';

@injectable()
export class Authenticator {
  protected accessTokenExpiresIn: string = '20d';
  protected refreshTokenExpiresIn: string = '180d';

  public static nonceExpiresIn: number = 1000 * 60 * 10; // 10 minutes

  @inject('UserRepository')
  protected userRepository: UserRepository;
  @inject('TimeRepository')
  protected timeRepository: TimeRepository;
  @inject('ActivityManager')
  protected activityManager: ActivityManager;
  @inject('UserManager')
  protected userManager: UserManager;
  @inject('Mailer')
  protected mailer: Mailer;
  @inject('parameters')
  protected parameters: IConfigParameters;
  @inject('Signer')
  protected signer: Signer;
  @inject('RedisClient')
  protected redis: RedisClient;
  @inject('TonProofService')
  protected tonProofService: TonProofService;

  public async getNonce(address: string): Promise<string> {
    const nonce = this.signer.generateNonce();
    const key = `nonce:${address}`;

    await this.redis.setWithExpiry(key, nonce, Authenticator.nonceExpiresIn);

    return nonce;
  }

  public async loginEth(signature: string, address: string): Promise<IAuthTokens> {
    const key = `nonce:${address}`;
    const nonce = await this.redis.get(key);

    if (!nonce) {
      throw new AuthenticationException('Nonce is not available or expired');
    }

    const isValid = this.signer.verify(nonce, signature, address);

    if (!isValid) {
      throw new AuthenticationException('Signature is not valid');
    }

    let user = await this.userRepository.findByAddressPublic(address);

    if (!user) {
      user = await this.createUserWithDemoData(address);
    }

    return this.getTokens(user);
  }

  public async loginTon(payload: IAuthTonPayload): Promise<IAuthTokens> {
    const address = payload.address;
    // const key = `nonce:${address}`;
    // const nonce = await this.redis.get(key);

    // console.log(nonce);
    // console.log(address);
    // console.log(payload);

    // if (!nonce) {
    //   throw new AuthenticationException('Nonce is not available or expired');
    // }

    const isValid = this.tonProofService.checkProof(payload);

    if (!isValid) {
      throw new AuthenticationException('Signature is not valid');
    }

    let user = await this.userRepository.findByAddressPublic(address);

    if (!user) {
      user = await this.createUserWithDemoData(address);
    }

    return this.getTokens(user);
  }

  public async getUserFromRefreshToken(token: string): Promise<User> {
    const payload = this.decodeJwtToken(token);
    const userId = (payload as jwt.JwtPayload).id;

    if (!userId) {
      throw new AuthenticationException('Refresh token is not valid');
    }

    try {
      return await this.userRepository.findOneByIdOrFail(userId);
    } catch (err) {
      throw new AuthenticationException('User does not exist');
    }
  }

  public async getUserFromJwtTokenOrThrowException(token: string): Promise<User> {
    const user = await this.getUserFromJwtToken(token);

    if (!user) {
      throw new AuthenticationException('invalid auth token');
    }

    return user;
  }

  public async getUserFromJwtToken(token: string): Promise<User | any> {
    try {
      const tokenData: any = this.decodeJwtToken(token);

      if (tokenData.emailOrPhone) {
        const user = await this.userRepository.findByEmailPhone(tokenData.emailOrPhone);

        if (user) {
          return Promise.resolve(user);
        }
      }
      if (tokenData.address) {
        const user = await this.userRepository.findByAddressPublic(tokenData.address);

        if (user) {
          return Promise.resolve(user);
        }
      }

      return Promise.resolve(null);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  public getEmailOrPhoneOrThrowError(token: string): string {
    const tokenData: any = this.decodeJwtToken(token);

    return tokenData.emailOrPhone;
  }

  public getJwtIatOrThrowError(token: string): string {
    const tokenData: any = this.decodeJwtToken(token);

    return tokenData.iat.toString();
  }

  public decodeJwtToken(token: string) {
    return jwt.verify(token, this.parameters.jwtSecret);
  }

  public getTokens(user: User): IAuthTokens {
    const accessToken = this.generateJwtToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {accessToken, refreshToken};
  }

  public generateRefreshToken(user: User): string {
    return jwt.sign({id: user.id}, this.parameters.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn,
    });
  }

  public generateJwtToken(user: User): string {
    const data: IAuthTokenData = {
      id: user.id,
      address: user.address,
      emailOrPhone: user.email || user.phone,
    };

    return jwt.sign(data, this.parameters.jwtSecret, {
      expiresIn: this.accessTokenExpiresIn,
    });
  }

  public static hashPassword(plainPassword: string): string {
    return bcrypt.hashSync(plainPassword, 8);
  }

  private async createUserWithDemoData(address: string): Promise<User> {
    const user = new User();
    user.address = address;
    user.roles = [EUserRole.ROLE_USER];

    await this.userManager.saveSingle(user);
    await this.activityManager.createDemoData(user);

    return user;
  }
}

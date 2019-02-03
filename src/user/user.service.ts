import { Injectable } from '@nestjs/common';
import { Connection } from 'typeorm';

import { LoggerService } from '../logger/logger.service';
import { User } from '../db/entities/user.entity';
import {
  USER_FIELDS,
  USER_JOIN_OPENED_GAME,
  USER_JOIN_CURRENT_GAMES,
  USER_JOIN_CURRENT_WATCH,
} from '../db/scopes/User';

@Injectable()
export class UserService {

  constructor(private connection: Connection, private logger: LoggerService) { }

  public findOne(email: string): Promise<User | undefined> {
    this.logger.info('find one user');

    return this.connection.getRepository(User)
      .createQueryBuilder('user')
      .select(USER_FIELDS)
      .leftJoin(...USER_JOIN_OPENED_GAME)
      .leftJoin(...USER_JOIN_CURRENT_GAMES)
      .leftJoin(...USER_JOIN_CURRENT_WATCH)
      .where({ email })
      .getOne();
  }

  public findOneByUsername(username: string): Promise<User | undefined> {
    this.logger.info('find one user');

    return this.connection.getRepository(User)
      .createQueryBuilder('user')
      .select(USER_FIELDS)
      .leftJoin(...USER_JOIN_OPENED_GAME)
      .leftJoin(...USER_JOIN_CURRENT_GAMES)
      .leftJoin(...USER_JOIN_CURRENT_WATCH)
      .where({ username })
      .getOne();
  }

  public async register({
    username,
    email,
    provider,
    password,
    firstName,
    lastName,
    avatar,
  }: {
    username: string,
    email: string,
    provider?: string,
    password?: string,
    firstName?: string,
    lastName?: string,
    avatar?: string,
  }): Promise<User> {
    this.logger.info(`Create a new user => ${username}`);

    const user = new User();
    user.username = username;
    user.email = email;

    if (provider) {
      user.provider = provider;
      user.firstName = firstName;
      user.lastName = lastName;
      user.avatar = avatar;
    } else {
      // TODO: Add email regexp verification
      user.password = password;
    }

    try {
      const newUser = await this.connection.getRepository(User).save(user);

      this.logger.info(JSON.stringify(newUser));

      return newUser;
    } catch (error) {
      this.logger.error(error.message, error.trace);
      throw new Error('error'); // TODO Error
    }
  }

}

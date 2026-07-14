import { PublicUser, toPublicUser } from '@domain/entities/User';
import { IRoleRepository } from '@domain/repositories/IRoleRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { AppError } from '@shared/errors/AppError';

export class GetCurrentUser {
  constructor(
    private readonly users: IUserRepository,
    private readonly roles: IRoleRepository,
  ) {}

  async execute(userId: number): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user || user.isDeleted) throw AppError.unauthorized();
    const auth = await this.roles.getUserAuthorization(userId);
    return toPublicUser(user, auth.roles, auth.permissions);
  }
}

import { Role, UserAuthorization } from '@domain/entities/Role';

export interface IRoleRepository {
  findByName(name: string): Promise<Role | null>;
  /** Roles + effective (database-driven) permissions for a user. */
  getUserAuthorization(userId: number): Promise<UserAuthorization>;
  assignRoleToUser(userId: number, roleId: number, createdBy: number | null): Promise<void>;
}

import { Role, UserAuthorization } from '@domain/entities/Role';

export interface IRoleRepository {
  findByName(name: string): Promise<Role | null>;
  /** Roles + effective (database-driven) permissions for a user. */
  getUserAuthorization(userId: string): Promise<UserAuthorization>;
  assignRoleToUser(userId: string, roleId: string, createdBy: string | null): Promise<void>;
  /** True when at least one non-deleted user holds the role (bootstrap guard). */
  anyUserHasRole(roleName: string): Promise<boolean>;
}

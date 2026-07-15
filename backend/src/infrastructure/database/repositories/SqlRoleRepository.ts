import { Role, UserAuthorization } from '@domain/entities/Role';
import { IRoleRepository } from '@domain/repositories/IRoleRepository';
import { execQuery } from '@infrastructure/database/connection';

export class SqlRoleRepository implements IRoleRepository {
  async findByName(name: string): Promise<Role | null> {
    const rows = await execQuery<{
      Id: string;
      Name: string;
      NameAr: string;
      Description: string | null;
    }>(`SELECT Id, Name, NameAr, Description FROM dbo.Roles WHERE Name = @name AND IsDeleted = 0`, {
      name,
    });
    const row = rows[0];
    return row
      ? { id: row.Id, name: row.Name, nameAr: row.NameAr, description: row.Description }
      : null;
  }

  async getUserAuthorization(userId: string): Promise<UserAuthorization> {
    const roleRows = await execQuery<{ Name: string }>(
      `SELECT r.Name
       FROM dbo.UserRoles ur
       JOIN dbo.Roles r ON r.Id = ur.RoleId AND r.IsDeleted = 0
       WHERE ur.UserId = @userId AND ur.IsDeleted = 0`,
      { userId },
    );
    const permissionRows = await execQuery<{ Code: string }>(
      `SELECT DISTINCT p.Code
       FROM dbo.UserRoles ur
       JOIN dbo.RolePermissions rp ON rp.RoleId = ur.RoleId AND rp.IsDeleted = 0
       JOIN dbo.Permissions p ON p.Id = rp.PermissionId AND p.IsDeleted = 0
       WHERE ur.UserId = @userId AND ur.IsDeleted = 0`,
      { userId },
    );
    return {
      roles: roleRows.map((row) => row.Name),
      permissions: permissionRows.map((row) => row.Code),
    };
  }

  async assignRoleToUser(userId: string, roleId: string, createdBy: string | null): Promise<void> {
    // Revive a soft-deleted assignment instead of violating the unique key
    await execQuery(
      `IF EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @userId AND RoleId = @roleId)
         UPDATE dbo.UserRoles
         SET IsDeleted = 0, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @createdBy
         WHERE UserId = @userId AND RoleId = @roleId
       ELSE
         INSERT INTO dbo.UserRoles (UserId, RoleId, CreatedBy) VALUES (@userId, @roleId, @createdBy)`,
      { userId, roleId, createdBy },
    );
  }

  async anyUserHasRole(roleName: string): Promise<boolean> {
    const rows = await execQuery(
      `SELECT TOP 1 1 AS X
       FROM dbo.UserRoles ur
       JOIN dbo.Roles r ON r.Id = ur.RoleId AND r.IsDeleted = 0
       JOIN dbo.Users u ON u.Id = ur.UserId AND u.IsDeleted = 0
       WHERE r.Name = @roleName AND ur.IsDeleted = 0`,
      { roleName },
    );
    return rows.length > 0;
  }
}
